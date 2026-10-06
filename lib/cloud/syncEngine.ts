import type { OutgoingRecord, RemoteRecord, SyncCollection } from "@/lib/data/cloud";
import type { LearningDataSnapshot, OwnerProfile } from "@/types";

/** Everything that syncs, keyed "collection/id". */
export type LocalRecords = Map<string, { collection: SyncCollection; id: string; data: unknown }>;
/** Fingerprint of each record as of the last successful sync ("collection/id" → hash). */
export type SyncBase = Record<string, string>;

export const recordKey = (collection: SyncCollection, id: string) => `${collection}/${id}`;

/** JSON with sorted object keys, so equal data always gives the same string. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`;
}

/** FNV-1a 32-bit + length: a compact change fingerprint. */
export function fingerprint(value: unknown): string {
  const text = stableStringify(value);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}.${text.length.toString(36)}`;
}

export function toLocalRecords(snapshot: LearningDataSnapshot, owner: OwnerProfile): LocalRecords {
  const records: LocalRecords = new Map();
  const add = (collection: SyncCollection, items: { id: string }[]) => {
    for (const item of items) records.set(recordKey(collection, item.id), { collection, id: item.id, data: item });
  };
  add("students", snapshot.students);
  add("lists", snapshot.lists);
  add("mistakes", snapshot.mistakes);
  add("sessions", snapshot.sessions);
  add("owner", [owner]);
  return records;
}

export function fromLocalRecords(records: LocalRecords, fallbackOwner: OwnerProfile): { snapshot: LearningDataSnapshot; owner: OwnerProfile } {
  const pick = <T>(collection: SyncCollection) =>
    [...records.values()].filter((r) => r.collection === collection).map((r) => r.data as T);
  return {
    snapshot: {
      students: pick("students"),
      lists: pick("lists"),
      mistakes: pick("mistakes"),
      sessions: pick("sessions"),
    },
    owner: pick<OwnerProfile>("owner")[0] ?? fallbackOwner,
  };
}

export interface SyncPlan {
  /** Local data after applying remote changes (unchanged keys keep their order). */
  merged: LocalRecords;
  /** How many remote changes were applied locally. */
  appliedFromRemote: number;
  /** Local changes to upload. */
  toPush: OutgoingRecord[];
  /** Base after the pull (push results are added by finishSync). */
  base: SyncBase;
}

/**
 * Decide what to download and upload.
 *  - local change = fingerprint differs from the base (new, edited, or deleted since the last sync)
 *  - remote rows for keys without a local change are applied locally
 *  - when both sides changed, this device's unsent change wins (it is uploaded)
 */
export function planSync(
  local: LocalRecords,
  base: SyncBase,
  remote: RemoteRecord[],
  now: string,
  /** Untouched defaults (e.g. a new device's owner PIN 0000) never override the cloud on first sync. */
  isPristine: (key: string, data: unknown) => boolean = () => false,
): SyncPlan {
  const changed = new Set<string>();
  for (const [key, record] of local) {
    if (fingerprint(record.data) === base[key]) continue;
    if (!(key in base) && isPristine(key, record.data)) continue;
    changed.add(key);
  }
  for (const key of Object.keys(base)) if (!local.has(key)) changed.add(key);

  // Latest row per key (rows arrive oldest first).
  const latest = new Map<string, RemoteRecord>();
  for (const row of remote) latest.set(recordKey(row.collection, row.id), row);

  const merged: LocalRecords = new Map(local);
  const nextBase: SyncBase = { ...base };
  let appliedFromRemote = 0;

  for (const [key, row] of latest) {
    if (changed.has(key)) continue; // local edit wins; it is pushed below
    const current = merged.get(key);
    if (row.deleted || row.data === null) {
      if (current) {
        merged.delete(key);
        appliedFromRemote++;
      }
      delete nextBase[key];
      continue;
    }
    const hash = fingerprint(row.data);
    if (!current || fingerprint(current.data) !== hash) {
      merged.set(key, { collection: row.collection, id: row.id, data: row.data });
      appliedFromRemote++;
    }
    nextBase[key] = hash;
  }

  const toPush: OutgoingRecord[] = [...changed].map((key) => {
    const record = local.get(key);
    const [collection, ...rest] = key.split("/");
    const id = rest.join("/");
    return record
      ? { collection: record.collection, id: record.id, data: record.data, deleted: false, modifiedAt: now }
      : { collection: collection as SyncCollection, id, data: null, deleted: true, modifiedAt: now };
  });

  return { merged, appliedFromRemote, toPush, base: nextBase };
}

/** Record what the cloud now holds after a successful push. */
export function finishSync(base: SyncBase, pushed: OutgoingRecord[]): SyncBase {
  const next = { ...base };
  for (const record of pushed) {
    const key = recordKey(record.collection, record.id);
    if (record.deleted) delete next[key];
    else next[key] = fingerprint(record.data);
  }
  return next;
}

/** Newest server time seen — the cursor for the next pull. */
export function latestCursor(current: string | null, rows: { updatedAt: string }[]): string | null {
  let cursor = current;
  for (const row of rows) if (!cursor || row.updatedAt > cursor) cursor = row.updatedAt;
  return cursor;
}
