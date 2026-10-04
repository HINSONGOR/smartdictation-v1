import { withBase } from "@/lib/basePath";
import type { StrokeDataSource } from "./types";

/** Loads stroke data from the app's own /stroke-data folder, with an in-memory cache. */
export class LocalStrokeDataSource implements StrokeDataSource {
  private readonly cache = new Map<string, Promise<unknown | null>>();

  constructor(private readonly basePath = withBase("/stroke-data")) {}

  load(char: string): Promise<unknown | null> {
    let pending = this.cache.get(char);
    if (!pending) {
      pending = fetch(`${this.basePath}/${encodeURIComponent(char)}.json`)
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);
      this.cache.set(char, pending);
    }
    return pending;
  }
}

export const strokeDataSource: StrokeDataSource = new LocalStrokeDataSource();
