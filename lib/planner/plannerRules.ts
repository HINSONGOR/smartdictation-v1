import {
  BUILT_IN_CATEGORY_IDS,
  BUILT_IN_SUBJECT_IDS,
  COUNTDOWN_DAYS,
  type BuiltInCategoryId,
  type BuiltInSubjectId,
  type DateKey,
  type PlannerColor,
  type PlannerSettings,
  type PracticeSession,
  type RepeatRule,
  type StudentTask,
} from "@/types";

/** Pure planner rules (dates, categories, today view, auto-done). No storage, no UI. */

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day of a Date. */
export function dateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDateKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return dateKey(parseDateKey(value)) === value;
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000);
}

/** Hong Kong school years start in September: 2026-10-26 → "2026-27", 2027-03-01 → "2026-27". */
export function schoolYearOf(key: DateKey): string {
  const [y, m] = key.split("-").map(Number);
  const start = m >= 9 ? y : y - 1;
  return `${start}-${pad((start + 1) % 100)}`;
}

// ---- categories & subjects ------------------------------------------------

export interface CategoryView {
  id: string;
  /** Built-ins are named via i18n (`planner.category.<id>`); custom ones carry their name. */
  builtIn: boolean;
  name?: string;
  icon: string;
  color: PlannerColor;
}

export interface SubjectView {
  id: string;
  builtIn: boolean;
  name?: string;
  color: PlannerColor;
}

const BUILT_IN_CATEGORY_LOOK: Record<BuiltInCategoryId, { icon: string; color: PlannerColor }> = {
  dictation: { icon: "✏️", color: "blue" },
  exam: { icon: "📝", color: "red" },
  homework: { icon: "📚", color: "green" },
  notice: { icon: "📄", color: "amber" },
  revision: { icon: "📖", color: "purple" },
  other: { icon: "⭐", color: "gray" },
};

const BUILT_IN_SUBJECT_COLOR: Record<BuiltInSubjectId, PlannerColor> = {
  chinese: "red",
  english: "blue",
  math: "green",
  gs: "amber",
};

export function categoriesOf(settings: PlannerSettings | null): CategoryView[] {
  return [
    ...BUILT_IN_CATEGORY_IDS.map((id) => ({ id, builtIn: true, ...BUILT_IN_CATEGORY_LOOK[id] })),
    ...(settings?.categories ?? []).map((c) => ({ ...c, builtIn: false })),
  ];
}

export function subjectsOf(settings: PlannerSettings | null): SubjectView[] {
  return [
    ...BUILT_IN_SUBJECT_IDS.map((id) => ({ id, builtIn: true, color: BUILT_IN_SUBJECT_COLOR[id] })),
    ...(settings?.subjects ?? []).map((s) => ({ ...s, builtIn: false })),
  ];
}

/** A task whose category was removed shows as "other". */
export function categoryFor(task: Pick<StudentTask, "categoryId">, categories: CategoryView[]): CategoryView {
  return categories.find((c) => c.id === task.categoryId) ?? categories.find((c) => c.id === "other")!;
}

// ---- auto-done --------------------------------------------------------------

/**
 * A linked task counts as done once the linked practice happened after the task was last changed
 * (so un-ticking it by hand sticks until the next practice).
 * Reads practice sessions only — the dictation system itself is not changed.
 */
export function autoDoneAt(task: StudentTask, sessions: PracticeSession[]): string | null {
  const link = task.link;
  if (task.done || !link || link.kind === "knowledge") return null; // notes are read, not practised
  const match = sessions
    .filter((s) => s.finishedAt >= task.updatedAt)
    .filter((s) =>
      link.kind === "dictationList"
        ? s.listId === link.listId && (s.kind ?? "list") !== "review"
        : s.kind === "review" && s.language === link.language,
    )
    .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))[0];
  return match?.finishedAt ?? null;
}

// ---- today view -------------------------------------------------------------

const byDateTime = (a: StudentTask, b: StudentTask) =>
  a.date.localeCompare(b.date) || (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.createdAt.localeCompare(b.createdAt);

export interface Countdown {
  task: StudentTask;
  days: number;
}

export interface TodayView {
  /** Not done, before today. */
  overdue: StudentTask[];
  /** Today's tasks, done or not. */
  today: StudentTask[];
  /** Not done, after today (next 14 days). */
  upcoming: StudentTask[];
  /** Exams / dictations within COUNTDOWN_DAYS (today included). */
  countdowns: Countdown[];
  done: number;
  total: number;
}

const COUNTDOWN_CATEGORIES = new Set(["exam", "dictation"]);

export function todayView(tasks: StudentTask[], today: DateKey): TodayView {
  const sorted = [...tasks].sort(byDateTime);
  const todays = sorted.filter((t) => t.date === today);
  const horizon = addDays(today, 14);
  return {
    // A missed day of a repeating task doesn't pile up as overdue (it still shows in check-in).
    overdue: sorted.filter((t) => !t.done && t.date < today && !t.routineId),
    today: todays,
    upcoming: sorted.filter((t) => !t.done && t.date > today && t.date <= horizon),
    countdowns: sorted
      .filter((t) => !t.done && COUNTDOWN_CATEGORIES.has(t.categoryId))
      .map((task) => ({ task, days: daysBetween(today, task.date) }))
      .filter((c) => c.days >= 0 && c.days <= COUNTDOWN_DAYS),
    done: todays.filter((t) => t.done).length,
    total: todays.length,
  };
}

// ---- repeating tasks ----------------------------------------------------------

/** Does a repeat rule put a task on this day? */
export function repeatsOn(rule: RepeatRule, day: DateKey): boolean {
  if (day < rule.start || (rule.end && day > rule.end)) return false;
  if (rule.pausedUntil && day <= rule.pausedUntil) return false;
  if (rule.skip?.includes(day)) return false;
  const weekday = parseDateKey(day).getDay();
  if (rule.kind === "schoolDays") return weekday >= 1 && weekday <= 5;
  if (rule.kind === "weekly") return rule.weekdays?.includes(weekday) ?? false;
  return true;
}

/** Id of a repeating task's copy for one day — the same on every device, so syncing never duplicates it. */
export const occurrenceId = (templateId: string, day: DateKey) => `${templateId}~${day}`;

/** Days from `from` to `to` (inclusive) a repeating task falls on. */
export function occurrenceDays(rule: RepeatRule, from: DateKey, to: DateKey): DateKey[] {
  const days: DateKey[] = [];
  for (let day = from < rule.start ? rule.start : from; day <= to; day = addDays(day, 1)) {
    if (rule.end && day > rule.end) break;
    if (repeatsOn(rule, day)) days.push(day);
  }
  return days;
}

// ---- check-in (打卡) ----------------------------------------------------------

/** all = every task of the day done (checked in); some = part done; none = nothing done; empty = no tasks; future. */
export type DayStatus = "all" | "some" | "none" | "empty" | "future";

export function dayStatus(tasks: StudentTask[], day: DateKey, today: DateKey): DayStatus {
  const ofDay = tasks.filter((t) => t.date === day);
  if (day > today) return "future";
  if (ofDay.length === 0) return "empty";
  const done = ofDay.filter((t) => t.done).length;
  return done === ofDay.length ? "all" : done > 0 ? "some" : "none";
}

/** The `count` days ending with `day` (oldest first). */
export function lastDays(day: DateKey, count: number): DateKey[] {
  return Array.from({ length: count }, (_, i) => addDays(day, i - count + 1));
}

/** Monday-first week containing `day`. */
export function weekOf(day: DateKey): DateKey[] {
  const offset = (parseDateKey(day).getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => addDays(day, i - offset));
}

/**
 * Check-in streak: consecutive days on which every task was done.
 * Days without tasks (e.g. weekends) neither count nor break it; today only counts once complete.
 */
export function checkInStreak(tasks: StudentTask[], today: DateKey): number {
  const days = new Set(tasks.map((t) => t.date));
  const earliest = [...days].sort()[0];
  if (!earliest) return 0;
  let streak = 0;
  let day = dayStatus(tasks, today, today) === "all" ? today : addDays(today, -1);
  for (; day >= earliest; day = addDays(day, -1)) {
    const status = dayStatus(tasks, day, today);
    if (status === "empty") continue;
    if (status !== "all") break;
    streak++;
  }
  return streak;
}

// ---- exams ------------------------------------------------------------------

export interface ExamCard {
  exam: StudentTask;
  days: number;
  /** Revision tasks planned for this exam. */
  revision: StudentTask[];
  revisionDone: number;
}

const EXAM_CATEGORIES = new Set(["exam", "dictation"]);

/** Exams and dictations: upcoming (soonest first) and finished (latest first), with their revision progress. */
export function examsView(tasks: StudentTask[], today: DateKey): { upcoming: ExamCard[]; past: ExamCard[] } {
  const cards = [...tasks]
    .filter((t) => EXAM_CATEGORIES.has(t.categoryId))
    .sort(byDateTime)
    .map((exam) => {
      const revision = tasks.filter((t) => t.examId === exam.id).sort(byDateTime);
      return { exam, days: daysBetween(today, exam.date), revision, revisionDone: revision.filter((t) => t.done).length };
    });
  return { upcoming: cards.filter((c) => c.days >= 0), past: cards.filter((c) => c.days < 0).reverse() };
}

/** Tasks per day, for the calendar. */
export function tasksByDay(tasks: StudentTask[]): Map<DateKey, StudentTask[]> {
  const days = new Map<DateKey, StudentTask[]>();
  for (const task of [...tasks].sort(byDateTime)) {
    const list = days.get(task.date) ?? [];
    list.push(task);
    days.set(task.date, list);
  }
  return days;
}

/** The 6-week grid (Monday first) shown for a month: `month` is "YYYY-MM". */
export function monthGrid(month: string): DateKey[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = dateKey(new Date(y, m - 1, 1 - offset));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}
