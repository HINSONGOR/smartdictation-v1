import type { ContentRepository, MistakeRepository, PracticeRepository } from "@/lib/data";
import { isMastered } from "@/lib/mistakes/mistakeRules";
import type { MistakeRecord, PracticeSession } from "@/types";
import { buildOverview, dailyActivity, listPerformance, type DayActivity, type ListPerformance, type StatsOverview } from "./statsCalc";

export interface RecentSession {
  session: PracticeSession;
  /** Word list title; null for mistake review or a deleted list. */
  title: string | null;
}

export interface StudentStats {
  overview: StatsOverview;
  /** Last 14 days, oldest first. */
  daily: DayActivity[];
  lists: ListPerformance[];
  recent: RecentSession[];
  /** Active mistakes, most frequent first. */
  topMistakes: MistakeRecord[];
  activeMistakes: number;
  masteredMistakes: number;
}

export const STATS_DAYS = 14;

/** Learning statistics for one student. Read-only; everything is scoped by studentId. */
export class StatsService {
  constructor(
    private readonly practice: PracticeRepository,
    private readonly mistakes: MistakeRepository,
    private readonly content: ContentRepository,
  ) {}

  /** Just the headline numbers (dashboard card, owner panel). */
  async overview(studentId: string, today: Date = new Date()): Promise<StatsOverview> {
    return buildOverview(await this.practice.listByStudent(studentId), today);
  }

  async forStudent(studentId: string, today: Date = new Date(), { recent = 10, mistakes = 10 } = {}): Promise<StudentStats> {
    const [sessions, records, lists] = await Promise.all([
      this.practice.listByStudent(studentId),
      this.mistakes.listByStudent(studentId),
      this.content.listByStudent(studentId),
    ]);
    const titleById = new Map(lists.map((l) => [l.id, l.title]));
    const active = records.filter((r) => !isMastered(r));

    return {
      overview: buildOverview(sessions, today),
      daily: dailyActivity(sessions, STATS_DAYS, today),
      lists: listPerformance(sessions, lists),
      recent: [...sessions]
        .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
        .slice(0, recent)
        .map((session) => ({ session, title: session.listId ? (titleById.get(session.listId) ?? null) : null })),
      topMistakes: [...active].sort((a, b) => b.count - a.count || b.lastMistakeAt.localeCompare(a.lastMistakeAt)).slice(0, mistakes),
      activeMistakes: active.length,
      masteredMistakes: records.length - active.length,
    };
  }
}
