import type { DateKey } from "@/types";
import { addDays } from "./plannerRules";

export interface RevisionDay {
  date: DateKey;
  /** Scope parts to revise that day; empty = revise everything again. */
  topics: string[];
}

/**
 * Spread an exam's scope over the days before it (自動排溫習):
 * from `days` days before the exam (but not before today) up to the day before the exam.
 * Parts are shared out in order; spare days at the end become "revise everything" days.
 */
export function planRevision(examDate: DateKey, topics: string[], today: DateKey, days: number): RevisionDay[] {
  const first = addDays(examDate, -days) < today ? today : addDays(examDate, -days);
  const dates: DateKey[] = [];
  for (let d = first; d < examDate; d = addDays(d, 1)) dates.push(d);
  if (dates.length === 0) return [];
  if (topics.length === 0) return dates.map((date) => ({ date, topics: [] }));

  const plan = dates.map((date) => ({ date, topics: [] as string[] }));
  const studyDays = Math.min(dates.length, topics.length);
  topics.forEach((topic, i) => plan[Math.floor((i * studyDays) / topics.length)].topics.push(topic));
  return plan;
}
