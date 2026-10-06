/**
 * Data source switch — the single place that decides where data lives.
 *
 * V1: "local"  → Local Data / Local JSON (browser localStorage + bundled seed JSON)
 * V2: add e.g. "firestore" | "supabase" here with its own Repositories implementation.
 *     UI and services stay unchanged because they only depend on the interfaces
 *     in ./repositories.ts.
 */
import { createDefaultStore } from "./local/keyValueStore";
import { createLocalRepositories } from "./local/localRepositories";
import type { Repositories } from "./repositories";
import type { CloudStore } from "./cloud";
import { SupabaseCloudStore } from "./supabase/SupabaseCloudStore";

export type DataSource = "local";

export function createRepositories(source: DataSource): Repositories {
  switch (source) {
    case "local":
      return createLocalRepositories(createDefaultStore());
    default: {
      const unsupported: never = source;
      throw new Error(`Unsupported data source: ${String(unsupported)}`);
    }
  }
}

export type * from "./repositories";
export * from "./cloud";

/** Cloud store for sync (V1: Supabase). Only the composition root calls this. */
export function createCloudStore(url: string, publishableKey: string): CloudStore {
  return new SupabaseCloudStore(url, publishableKey);
}
