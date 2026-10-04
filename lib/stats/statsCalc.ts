import type { DictationLanguage, DictationList, PracticeSession } from "@/types";

/** Pure statistics over practice sessions. Dates use the device's local time zone. */

/** "YYYY-MM-DD" in local time. */
export function localDateKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Shift a date key by n days (noon anchor avoids daylight-saving edge cases). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return localDateKey(new Date(y, m - 1, d + n, 12));
}

export function accuracy(correct: number, total: number): number | null {
  return total > 0 ? correct / total : null;
}

export interface DayActivity {
  /** Local date key. */
  date: string;
  sessions: number;
  items: number;
  correct: number;
}

/** One entry per day for the last `days` days (oldest first, today last). */
export function dailyActivity(sessions: PracticeSession[], days: number, today: Date): DayActivity[] {
  const todayKey = localDateKey(today);
  const byDate = new Map<string, DayActivity>();
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(todayKey, -i);
    byDate.set(date, { date, sessions: 0, items: 0, correct: 0 });
  }
  for (const s of sessions) {
    const day = byDate.get(localDateKey(s.finishedAt));
    if (!day) continue;
    day.sessions += 1;
    day.items += s.total;
    day.correct += s.correct;
  }
  return [...byDate.values()];
}

/**
 * Consecutive practice days ending today — or ending yesterday when today has no practice yet,
 * so the streak doesn't look broken first thing in the morning.
 */
export function practiceStreak(sessions: PracticeSession[], today: Date): number {
  const days = new Set(sessions.map((s) => localDateKey(s.finishedAt)));
  let day = localDateKey(today);
  if (!days.has(day)) day = addDays(day, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export interface Totals {
  sessions: number;
  items: number;
  correct: number;
}

export interface StatsOverview extends Totals {
  accuracy: number | null;
  streak: number;
  /** Sessions in the last 7 days including today. */
  sessionsLast7Days: number;
  byLanguage: Record<DictationLanguage, Totals>;
  lastPracticeAt: string | null;
}

export function buildOverview(sessions: PracticeSession[], today: Date): StatsOverview {
  const empty = (): Totals => ({ sessions: 0, items: 0, correct: 0 });
  const byLanguage: Record<DictationLanguage, Totals> = { zh: empty(), en: empty() };
  const totals = empty();
  let lastPracticeAt: string | null = null;
  for (const s of sessions) {
    for (const t of [totals, byLanguage[s.language]]) {
      t.sessions += 1;
      t.items += s.total;
      t.correct += s.correct;
    }
    if (!lastPracticeAt || s.finishedAt > lastPracticeAt) lastPracticeAt = s.finishedAt;
  }
  const weekStart = addDays(localDateKey(today), -6);
  return {
    ...totals,
    accuracy: accuracy(totals.correct, totals.items),
    streak: practiceStreak(sessions, today),
    sessionsLast7Days: sessions.filter((s) => localDateKey(s.finishedAt) >= weekStart).length,
    byLanguage,
    lastPracticeAt,
  };
}

export interface ListPerformance {
  listId: string;
  title: string;
  language: DictationLanguage;
  timesPractised: number;
  last: { correct: number; total: number; at: string };
  bestAccuracy: number;
}

/** Whole-list runs per existing word list, most recently practised first. Retries / reviews don't count. */
export function listPerformance(sessions: PracticeSession[], lists: DictationList[]): ListPerformance[] {
  const listById = new Map(lists.map((l) => [l.id, l]));
  const byList = new Map<string, ListPerformance>();
  for (const s of sessions) {
    if ((s.kind ?? "list") !== "list" || !s.listId) continue;
    const list = listById.get(s.listId);
    if (!list) continue; // list was deleted
    const acc = accuracy(s.correct, s.total) ?? 0;
    const current = byList.get(s.listId);
    if (!current) {
      byList.set(s.listId, {
        listId: list.id,
        title: list.title,
        language: list.language,
        timesPractised: 1,
        last: { correct: s.correct, total: s.total, at: s.finishedAt },
        bestAccuracy: acc,
      });
      continue;
    }
    current.timesPractised += 1;
    current.bestAccuracy = Math.max(current.bestAccuracy, acc);
    if (s.finishedAt >= current.last.at) current.last = { correct: s.correct, total: s.total, at: s.finishedAt };
  }
  return [...byList.values()].sort((a, b) => b.last.at.localeCompare(a.last.at));
}
