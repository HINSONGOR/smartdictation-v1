/**
 * Minimal synchronous key/value store holding JSON values.
 * Only the local repositories use this; nothing above the data layer may import it.
 */
export interface KeyValueStore {
  read<T>(key: string): T | null;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
}

export const STORAGE_PREFIX = "sd:v1:";

export class BrowserLocalStore implements KeyValueStore {
  read<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  write<T>(key: string, value: T): void {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  }

  remove(key: string): void {
    window.localStorage.removeItem(STORAGE_PREFIX + key);
  }
}

/** Used during SSR, in private modes where localStorage throws, and in tests. */
export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();

  read<T>(key: string): T | null {
    const raw = this.data.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  write<T>(key: string, value: T): void {
    this.data.set(key, JSON.stringify(value));
  }

  remove(key: string): void {
    this.data.delete(key);
  }
}

export function createDefaultStore(): KeyValueStore {
  if (typeof window === "undefined") return new MemoryStore();
  try {
    const probe = STORAGE_PREFIX + "__probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return new BrowserLocalStore();
  } catch {
    return new MemoryStore();
  }
}
