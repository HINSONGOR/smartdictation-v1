import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import type { DictationList, PracticeKind, PracticeSession } from "@/types";
import { addDays, buildOverview, dailyActivity, listPerformance, localDateKey, practiceStreak } from "./statsCalc";
import { StatsService } from "./StatsService";

/** Local noon on a given day, so local-date maths is unambiguous in any time zone. */
const day = (y: number, m: number, d: number, hour = 12) => new Date(y, m - 1, d, hour);
const TODAY = day(2026, 10, 10);

let n = 0;
function session(at: Date, correct: number, total: number, patch: Partial<PracticeSession> = {}): PracticeSession {
  n++;
  return {
    id: `s${n}`,
    studentId: "a",
    kind: "list" as PracticeKind,
    listId: "l1",
    language: "zh",
    mode: "paper",
    total,
    correct,
    answers: [],
    startedAt: at.toISOString(),
    finishedAt: at.toISOString(),
    ...patch,
  };
}

const list = (id: string, title: string): DictationList => ({
  id, studentId: "a", language: "zh", title, items: [], createdAt: "2026-10-01T00:00:00.000Z", updatedAt: "2026-10-01T00:00:00.000Z",
});

describe("date keys", () => {
  it("formats local dates and shifts across month ends", () => {
    expect(localDateKey(day(2026, 10, 1))).toBe("2026-10-01");
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("practiceStreak", () => {
  it("counts consecutive days ending today", () => {
    const s = [session(day(2026, 10, 10), 1, 1), session(day(2026, 10, 9), 1, 1), session(day(2026, 10, 8, 20), 1, 1)];
    expect(practiceStreak(s, TODAY)).toBe(3);
  });

  it("still counts a streak ending yesterday (nothing yet today)", () => {
    expect(practiceStreak([session(day(2026, 10, 9), 1, 1), session(day(2026, 10, 8), 1, 1)], TODAY)).toBe(2);
  });

  it("is broken by a missing day", () => {
    expect(practiceStreak([session(day(2026, 10, 10), 1, 1), session(day(2026, 10, 8), 1, 1)], TODAY)).toBe(1);
    expect(practiceStreak([session(day(2026, 10, 7), 1, 1)], TODAY)).toBe(0);
    expect(practiceStreak([], TODAY)).toBe(0);
  });
});

describe("dailyActivity", () => {
  it("returns every day of the window, oldest first, summing sessions", () => {
    const days = dailyActivity(
      [session(day(2026, 10, 10, 9), 3, 4), session(day(2026, 10, 10, 18), 2, 2), session(day(2026, 10, 1), 5, 5)],
      7,
      TODAY,
    );
    expect(days.map((d) => d.date)).toEqual([
      "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10",
    ]);
    expect(days[6]).toEqual({ date: "2026-10-10", sessions: 2, items: 6, correct: 5 });
    expect(days.slice(0, 6).every((d) => d.items === 0)).toBe(true); // 1 Oct is outside the window
  });
});

describe("buildOverview", () => {
  it("totals, accuracy, per language and the last 7 days", () => {
    const o = buildOverview(
      [
        session(day(2026, 10, 10), 8, 10),
        session(day(2026, 10, 4), 1, 2, { language: "en" }),
        session(day(2026, 10, 3), 4, 4, { language: "en" }),
      ],
      TODAY,
    );
    expect(o).toMatchObject({ sessions: 3, items: 16, correct: 13, sessionsLast7Days: 2, streak: 1 });
    expect(o.accuracy).toBeCloseTo(13 / 16);
    expect(o.byLanguage.en).toEqual({ sessions: 2, items: 6, correct: 5 });
    expect(o.lastPracticeAt).toBe(day(2026, 10, 10).toISOString());
  });

  it("has no accuracy without practice", () => {
    expect(buildOverview([], TODAY)).toMatchObject({ sessions: 0, accuracy: null, streak: 0, lastPracticeAt: null });
  });
});

describe("listPerformance", () => {
  it("counts whole-list runs only, keeps the latest and best score, skips deleted lists", () => {
    const perf = listPerformance(
      [
        session(day(2026, 10, 5), 2, 4),
        session(day(2026, 10, 8), 3, 4),
        session(day(2026, 10, 9), 1, 1, { kind: "retry" }),
        session(day(2026, 10, 9), 1, 1, { kind: "review", listId: null }),
        session(day(2026, 10, 6), 4, 4, { listId: "l2" }),
        session(day(2026, 10, 7), 4, 4, { listId: "deleted" }),
      ],
      [list("l1", "第一課"), list("l2", "第二課")],
    );
    expect(perf.map((p) => p.title)).toEqual(["第一課", "第二課"]);
    expect(perf[0]).toMatchObject({ timesPractised: 2, last: { correct: 3, total: 4 }, bestAccuracy: 0.75 });
    expect(perf[1]).toMatchObject({ timesPractised: 1, bestAccuracy: 1 });
  });
});

describe("StatsService", () => {
  it("only reads the requested student's data", async () => {
    const repos = createLocalRepositories(new MemoryStore());
    await repos.content.save(list("l1", "第一課"));
    await repos.practice.save(session(day(2026, 10, 10), 3, 4));
    await repos.practice.save(session(day(2026, 10, 10), 9, 9, { studentId: "b" }));
    await repos.mistakes.save({ id: "m1", studentId: "a", language: "zh", listId: "l1", itemId: "i", text: "蓋子", count: 3, lastMistakeAt: "2026-10-10T00:00:00.000Z" });
    await repos.mistakes.save({ id: "m2", studentId: "a", language: "zh", listId: "l1", itemId: "j", text: "蛋糕", count: 1, lastMistakeAt: "2026-10-09T00:00:00.000Z", masteredAt: "2026-10-10T00:00:00.000Z" });

    const stats = await new StatsService(repos.practice, repos.mistakes, repos.content).forStudent("a", TODAY);
    expect(stats.overview).toMatchObject({ sessions: 1, items: 4, correct: 3 });
    expect(stats.daily).toHaveLength(14);
    expect(stats.recent.map((r) => r.title)).toEqual(["第一課"]);
    expect(stats.topMistakes.map((m) => m.text)).toEqual(["蓋子"]);
    expect([stats.activeMistakes, stats.masteredMistakes]).toEqual([1, 1]);

    const empty = await new StatsService(repos.practice, repos.mistakes, repos.content).forStudent("c", TODAY);
    expect(empty.overview.sessions).toBe(0);
    expect(empty.recent).toEqual([]);
  });
});
