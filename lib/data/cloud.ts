/**
 * Cloud store contract (data-source port). Services only see this interface;
 * V1 implementation: ./supabase/SupabaseCloudStore.ts.
 */

/** V1 record groups that are synced (device settings like theme are not). */
export const SYNC_COLLECTIONS = ["students", "lists", "mistakes", "sessions", "owner"] as const;
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

export interface CloudUser {
  id: string;
  email: string | null;
}

/** A record as stored in the cloud. */
export interface RemoteRecord {
  collection: SyncCollection;
  id: string;
  /** null when deleted. */
  data: unknown | null;
  deleted: boolean;
  /** When a device changed it (ISO). */
  modifiedAt: string;
  /** Server write time (ISO) — used as the "changed since" cursor. */
  updatedAt: string;
}

export type OutgoingRecord = Omit<RemoteRecord, "updatedAt">;

/** Auth failures the UI explains. */
export type CloudErrorCode =
  | "cloud.invalidCredentials"
  | "cloud.emailNotConfirmed"
  | "cloud.emailTaken"
  | "cloud.weakPassword"
  | "cloud.invalidEmail"
  | "cloud.invalidUsername"
  | "cloud.network"
  | "cloud.notSetUp"
  | "cloud.unknown";

export interface SignUpResult {
  user: CloudUser | null;
  /** true when Supabase sent a confirmation email first. */
  needsConfirmation: boolean;
}

export interface CloudStore {
  getUser(): Promise<CloudUser | null>;
  onAuthChange(listener: (user: CloudUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<CloudUser>;
  signUp(email: string, password: string, redirectTo: string): Promise<SignUpResult>;
  signOut(): Promise<void>;
  /** Records written after `cursor` (server time), oldest first. null = everything. */
  pullSince(userId: string, cursor: string | null): Promise<RemoteRecord[]>;
  /** Upsert records; returns them as stored (with server updatedAt). */
  push(userId: string, records: OutgoingRecord[]): Promise<RemoteRecord[]>;
}

/** Thrown by CloudStore implementations with a code the UI can translate. */
export class CloudError extends Error {
  constructor(readonly code: CloudErrorCode, message?: string) {
    super(message ?? code);
    this.name = "CloudError";
  }
}
