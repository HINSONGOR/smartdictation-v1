import {
  CloudError,
  type BackupStore,
  type ChangeFeed,
  type CloudErrorCode,
  type CloudStore,
  type CloudUser,
  type OwnerRepository,
  type SyncState,
  type SyncStateRepository,
} from "@/lib/data";
import { nowIso } from "@/lib/utils/id";
import { DEFAULT_OWNER_PIN, type OwnerProfile } from "@/types";
import { accountEmail } from "./account";
import { finishSync, fromLocalRecords, latestCursor, planSync, recordKey, toLocalRecords } from "./syncEngine";

export type CloudStatus =
  | { state: "loading" }
  | { state: "signedOut" }
  | {
      state: "signedIn";
      user: CloudUser;
      syncing: boolean;
      lastSyncedAt: string | null;
      /** Last sync problem (cleared by the next successful sync). */
      error: CloudErrorCode | null;
    };

export interface SyncResult {
  downloaded: number;
  uploaded: number;
}

/** A device that never changed its owner PIN must take the family's PIN from the cloud. */
const isDefaultOwner = (key: string, data: unknown) =>
  key === recordKey("owner", "owner") && (data as OwnerProfile | null)?.pin === DEFAULT_OWNER_PIN;

/** Wait this long after a local change before syncing (groups quick edits). */
const CHANGE_DEBOUNCE_MS = 3000;

/**
 * Cloud sync of V1 data for a logged-in family account.
 * Local data stays the source of truth on the device (works offline); sync merges it with the cloud
 * whenever the app opens, comes back online / into view, or data changes.
 */
export class CloudSyncService {
  private status: CloudStatus = { state: "loading" };
  private readonly listeners = new Set<(status: CloudStatus) => void>();
  private readonly appliedListeners = new Set<() => void>();
  private running: Promise<SyncResult | null> | null = null;
  private rerun = false;
  private applying = false;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  constructor(
    private readonly cloud: CloudStore,
    private readonly backup: BackupStore,
    private readonly owner: OwnerRepository,
    private readonly syncState: SyncStateRepository,
    private readonly changes: ChangeFeed,
  ) {}

  // ---- status ------------------------------------------------------------

  getStatus(): CloudStatus {
    return this.status;
  }

  subscribe(listener: (status: CloudStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called after cloud changes were written to this device (the UI reloads its data). */
  onRemoteApplied(listener: () => void): () => void {
    this.appliedListeners.add(listener);
    return () => this.appliedListeners.delete(listener);
  }

  private setStatus(status: CloudStatus) {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }

  private patchSignedIn(patch: Partial<Extract<CloudStatus, { state: "signedIn" }>>) {
    if (this.status.state === "signedIn") this.setStatus({ ...this.status, ...patch });
  }

  // ---- lifecycle ---------------------------------------------------------

  /** Restore the session and start syncing. Safe to call more than once. */
  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.changes.subscribe(() => {
      if (!this.applying) this.requestSync();
    });
    this.cloud.onAuthChange((user) => {
      if (!user && this.status.state === "signedIn") this.setStatus({ state: "signedOut" });
      // e.g. returning from the confirmation email link, or a login in another tab.
      else if (user && (this.status.state !== "signedIn" || this.status.user.id !== user.id)) void this.enterSession(user);
    });
    const user = await this.cloud.getUser().catch(() => null);
    await this.enterSession(user);
  }

  /** Sync soon (debounced). Used for local edits, coming online and returning to the app. */
  requestSync(delayMs = CHANGE_DEBOUNCE_MS): void {
    if (this.status.state !== "signedIn") return;
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => {
      this.debounce = null;
      void this.syncNow();
    }, delayMs);
  }

  // ---- auth --------------------------------------------------------------

  /** Log in with the family account name + password. */
  async signIn(accountName: string, password: string): Promise<SyncResult | null> {
    const user = await this.cloud.signIn(accountEmail(accountName), password);
    return this.enterSession(user);
  }

  /**
   * Create the family account (account name + password, no email).
   * Throws cloud.emailNotConfirmed if Supabase still requires email confirmation (setting not turned off).
   */
  async signUp(accountName: string, password: string): Promise<void> {
    const result = await this.cloud.signUp(accountEmail(accountName), password, "");
    if (!result.user) throw new CloudError("cloud.emailNotConfirmed");
    await this.enterSession(result.user);
  }

  /** Stop syncing on this device. Local data stays here. */
  async signOut(): Promise<void> {
    await this.cloud.signOut().catch(() => undefined);
    await this.syncState.clear();
    this.setStatus({ state: "signedOut" });
  }

  private async enterSession(user: CloudUser | null): Promise<SyncResult | null> {
    if (!user) {
      this.setStatus({ state: "signedOut" });
      return null;
    }
    const state = await this.syncState.get();
    this.setStatus({
      state: "signedIn",
      user,
      syncing: false,
      lastSyncedAt: state?.userId === user.id ? state.lastSyncedAt : null,
      error: null,
    });
    return this.syncNow();
  }

  // ---- sync --------------------------------------------------------------

  /** Sync now; concurrent calls share one run (and trigger one more afterwards). */
  syncNow(): Promise<SyncResult | null> {
    if (this.status.state !== "signedIn") return Promise.resolve(null);
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.runSync().finally(() => {
      this.running = null;
      if (this.rerun) {
        this.rerun = false;
        void this.syncNow();
      }
    });
    return this.running;
  }

  private async runSync(): Promise<SyncResult | null> {
    if (this.status.state !== "signedIn") return null;
    const user = this.status.user;
    this.patchSignedIn({ syncing: true });
    try {
      const saved = await this.syncState.get();
      // A different account on this device starts fresh (this device's data is merged into it).
      const state: SyncState =
        saved && saved.userId === user.id ? saved : { userId: user.id, cursor: null, base: {}, lastSyncedAt: null };

      const [snapshot, owner] = await Promise.all([this.backup.readAll(), this.owner.get()]);
      const local = toLocalRecords(snapshot, owner);
      const remote = await this.cloud.pullSince(user.id, state.cursor);
      const now = nowIso();
      const plan = planSync(local, state.base, remote, now, isDefaultOwner);

      if (plan.appliedFromRemote > 0) {
        const next = fromLocalRecords(plan.merged, owner);
        this.applying = true;
        try {
          await this.backup.replaceAll(next.snapshot);
          await this.owner.save(next.owner);
        } finally {
          this.applying = false;
        }
      }

      const pushed = plan.toPush.length ? await this.cloud.push(user.id, plan.toPush) : [];
      const nextState: SyncState = {
        userId: user.id,
        cursor: latestCursor(latestCursor(state.cursor, remote), pushed),
        base: finishSync(plan.base, plan.toPush),
        lastSyncedAt: now,
      };
      await this.syncState.save(nextState);
      this.patchSignedIn({ syncing: false, lastSyncedAt: now, error: null });
      if (plan.appliedFromRemote > 0) for (const listener of this.appliedListeners) listener();
      return { downloaded: plan.appliedFromRemote, uploaded: plan.toPush.length };
    } catch (error) {
      const code: CloudErrorCode = error instanceof CloudError ? error.code : "cloud.unknown";
      this.patchSignedIn({ syncing: false, error: code });
      return null;
    }
  }
}
