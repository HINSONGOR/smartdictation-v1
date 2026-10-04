/**
 * Stroke-order data source. V1: local JSON files served from /stroke-data (copied from
 * hanzi-writer-data at build time). Could later be swapped for another source.
 */
export interface StrokeDataSource {
  /** Stroke data for one character, or null if unavailable. */
  load(char: string): Promise<unknown | null>;
}

/** Characters that can have stroke animations (CJK ideographs). */
export function isHanzi(char: string): boolean {
  return /\p{Script=Han}/u.test(char);
}
