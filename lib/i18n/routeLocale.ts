import type { Locale } from "@/types";

/**
 * Screens that always use one UI language, whatever the app language setting is.
 * English dictation (lists, editing, practice, English mistake review) is fully in English.
 */
export function forcedLocaleForPath(pathname: string): Locale | null {
  if (pathname === "/english" || pathname.startsWith("/english/")) return "en";
  if (pathname === "/mistakes/review/en") return "en";
  return null;
}
