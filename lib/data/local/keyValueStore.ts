/**
 * Minimal synchronous key/value store holding JSON values.
 * Only the local repositories use this; nothing above the data layer may import it.
 */
export interface KeyValueStore {
  read<T>(key: string): T | null;
  write<T>(key: string, value: T): void;
  remove(key: string): void;
  /** Called with the key after every write / remove. */
  subscribe(listener: (key: string) => void): () => void;
}

export const STORAGE_PREFIX = "sd:v1:";

abstract class ObservableStore implements KeyValueStore {
  private readonly listeners = new Set<(key: string) => void>();

  abstract read<T>(key: string): T | null;
  protected abstract set(key: string, raw: string | null): void;

  write<T>(key: string, value: T): void {
    this.set(key, JSON.stringify(value));
    this.emit(key);
  }

  remove(key: string): void {
    this.set(key, null);
    this.emit(key);
  }

  subscribe(listener: (key: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(key: string) {
    for (const listener of this.listeners) listener(key);
  }
}

export class BrowserLocalStore extends ObservableStore {
  read<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
      return raw === null ? null : (JSON.parse(raw) as T);
    } catch {
      return null;
    }
  }

  protected set(key: string, raw: string | null): void {
    if (raw === null) window.localStorage.removeItem(STORAGE_PREFIX + key);
    else window.localStorage.setItem(STORAGE_PREFIX + key, raw);
  }
}

/** Used during SSR, in private modes where localStorage throws, and in tests. */
export class MemoryStore extends ObservableStore {
  private data = new Map<string, string>();

  read<T>(key: string): T | null {
    const raw = this.data.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  protected set(key: string, raw: string | null): void {
    if (raw === null) this.data.delete(key);
    else this.data.set(key, raw);
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
