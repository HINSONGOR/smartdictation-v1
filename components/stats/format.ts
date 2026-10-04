import type { Locale } from "@/types";

export function formatPercent(value: number | null, locale: Locale, empty = "—"): string {
  return value === null ? empty : new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(value);
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
}

export function formatDateTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** "2026-10-03" (local date key) → short label like "10月3日" / "3 Oct". */
export function formatDayKey(key: string, locale: Locale): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(y, m - 1, d, 12));
}
