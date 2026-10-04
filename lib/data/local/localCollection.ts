import type { Entity } from "@/types";
import type { KeyValueStore } from "./keyValueStore";

/**
 * A JSON array of entities stored under one key.
 * Falls back to the bundled seed JSON until the first write.
 */
export class LocalCollection<T extends Entity> {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key: string,
    private readonly seed: readonly T[] = [],
  ) {}

  all(): T[] {
    return this.store.read<T[]>(this.key) ?? structuredClone([...this.seed]);
  }

  filter(predicate: (item: T) => boolean): T[] {
    return this.all().filter(predicate);
  }

  find(predicate: (item: T) => boolean): T | null {
    return this.all().find(predicate) ?? null;
  }

  upsert(item: T): void {
    const items = this.all();
    const index = items.findIndex((existing) => existing.id === item.id);
    if (index === -1) items.push(item);
    else items[index] = item;
    this.store.write(this.key, items);
  }

  removeWhere(predicate: (item: T) => boolean): void {
    this.store.write(
      this.key,
      this.all().filter((item) => !predicate(item)),
    );
  }
}
