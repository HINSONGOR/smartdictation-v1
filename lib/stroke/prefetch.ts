import { strokeDataSource } from "./localStrokeData";
import { isHanzi } from "./types";

/**
 * Warm the stroke-data cache for every Chinese character in the given texts.
 * Done when a practice opens (while online), so the service worker has the data for offline use.
 */
export function prefetchStrokeData(texts: string[]): void {
  const chars = new Set<string>();
  for (const text of texts) for (const char of text) if (isHanzi(char)) chars.add(char);
  for (const char of chars) void strokeDataSource.load(char);
}
