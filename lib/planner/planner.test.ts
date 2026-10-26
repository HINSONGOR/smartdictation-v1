import { beforeEach, describe, expect, it } from "vitest";
import type { Repositories } from "@/lib/data";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import { ServiceError } from "@/lib/errors";
import type { PracticeSession, StudentTask } from "@/types";
import { PlannerService } from "./PlannerService";
import { addDays, autoDoneAt, categoriesOf, daysBetween, isDateKey, monthGrid, schoolYearOf, todayView } from "./plannerRules";

const T = "2026-10-26T00:00:00.000Z";
const task = (patch: Partial<StudentTask>): StudentTask => ({
  id: "t", studentId: "a", title: "T", categoryId: "homework", date: "2026-10-26", done: false,
  schoolYear: "2026-27", createdAt: T, updatedAt: T, ...patch,
});
const session = (patch: Partial<PracticeSession>): PracticeSession => ({
  id: "s", studentId: "a", kind: "list", listId: "L1", language: "en", mode: "typing",
  total: 1, correct: 1, answers: [], startedAt: T, finishedAt: "2026-10-26T09:00:00.000Z", ...patch,
});

describe("plannerRules", () => {
  it("handles dates and Hong Kong school years", () => {
    expect(isDateKey("2026-02-29")).toBe(false);
    expect(isDateKey("2028-02-29")).toBe(true);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-10-26", "2026-11-02")).toBe(7);
    expect(schoolYearOf("2026-10-26")).toBe("2026-27");
    expect(schoolYearOf("2027-08-31")).toBe("2026-27");
    expect(schoolYearOf("2027-09-01")).toBe("2027-28");
  });

  it("builds a Monday-first 6-week month grid", () => {
    const grid = monthGrid("2026-11"); // 1 Nov 2026 is a Sunday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-10-26");
    expect(grid[6]).toBe("2026-11-01");
  });

  it("splits overdue / today / upcoming, counts today's progress and exam countdowns", () => {
    const view = todayView(
      [
        task({ id: "late", date: "2026-10-24" }),
        task({ id: "lateDone", date: "2026-10-24", done: true }),
        task({ id: "now", date: "2026-10-26", done: true }),
        task({ id: "now2", date: "2026-10-26", time: "08:00" }),
        task({ id: "exam", categoryId: "exam", date: "2026-11-02" }),
        task({ id: "farExam", categoryId: "exam", date: "2026-11-20" }),
      ],
      "2026-10-26",
    );
    expect(view.overdue.map((t) => t.id)).toEqual(["late"]);
    expect(view.today.map((t) => t.id)).toEqual(["now2", "now"]);
    expect([view.done, view.total]).toEqual([1, 2]);
    expect(view.countdowns.map((c) => [c.task.id, c.days])).toEqual([["exam", 7]]);
    expect(view.upcoming.map((t) => t.id)).toEqual(["exam"]);
  });

  it("marks a linked task done only by practice after the task was last changed", () => {
    const at = "2026-10-26T08:00:00.000Z";
    const linked = task({ link: { kind: "dictationList", listId: "L1", language: "en" }, createdAt: at, updatedAt: at });
    expect(autoDoneAt(linked, [session({ finishedAt: "2026-10-25T09:00:00.000Z" })])).toBeNull(); // before the task
    expect(autoDoneAt(linked, [session({ listId: "L2" })])).toBeNull(); // another list
    expect(autoDoneAt(linked, [session({ kind: "retry" })])).toBe("2026-10-26T09:00:00.000Z");
    const review = task({ link: { kind: "mistakeReview", language: "zh" } });
    expect(autoDoneAt(review, [session({ kind: "review", listId: null, language: "en" })])).toBeNull();
    expect(autoDoneAt(review, [session({ kind: "review", listId: null, language: "zh" })])).not.toBeNull();
  });
});

describe("PlannerService", () => {
  let repos: Repositories;
  let planner: PlannerService;

  beforeEach(() => {
    repos = createLocalRepositories(new MemoryStore());
    planner = new PlannerService(repos.tasks, repos.planner, repos.practice, repos.content);
  });

  const codeOf = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof ServiceError ? e.code : String(e)));

  it("creates, edits, completes and deletes tasks per student", async () => {
    const created = await planner.create("a", { title: " 數學作業 P.12 ", categoryId: "homework", subjectId: "math", date: "2026-10-27", minutes: 20 });
    expect(created).toMatchObject({ title: "數學作業 P.12", schoolYear: "2026-27", done: false });
    expect(await planner.listTasks("b")).toEqual([]); // other student sees nothing

    const edited = await planner.update("a", created.id, { title: "數學作業", categoryId: "homework", date: "2026-10-28" });
    expect(edited.minutes).toBeUndefined(); // cleared
    expect(edited.subjectId).toBeUndefined();
    expect((await planner.setDone("a", created.id, true)).done).toBe(true);
    await planner.remove("a", created.id);
    expect(await planner.listTasks("a")).toEqual([]);
  });

  it("validates input", async () => {
    const base = { title: "x", categoryId: "homework", date: "2026-10-27" };
    expect(await codeOf(planner.create("a", { ...base, title: "  " }))).toBe("task.titleRequired");
    expect(await codeOf(planner.create("a", { ...base, date: "2026-13-01" }))).toBe("task.dateInvalid");
    expect(await codeOf(planner.create("a", { ...base, categoryId: "nope" }))).toBe("task.categoryInvalid");
    expect(await codeOf(planner.create("a", { ...base, minutes: 0 }))).toBe("task.minutesInvalid");
  });

  it("marks linked dictation tasks done from practice records (dictation data untouched)", async () => {
    const past = "2026-01-01T00:00:00.000Z";
    const t = task({ id: "t1", categoryId: "dictation", link: { kind: "dictationList", listId: "L1", language: "en" }, createdAt: past, updatedAt: past });
    await repos.tasks.save(t);
    await repos.practice.save(session({ finishedAt: "2026-01-01T09:00:00.000Z" }));
    const [after] = await planner.listTasks("a");
    expect(after).toMatchObject({ id: t.id, done: true });
    expect((await repos.tasks.getForStudent("a", t.id))?.done).toBe(true); // saved

    // Un-ticked by hand: stays open until the next practice.
    await planner.setDone("a", t.id, false);
    expect((await planner.listTasks("a"))[0].done).toBe(false);
  });

  it("lets the family add and remove categories and subjects", async () => {
    await planner.addCategory("興趣班", "🎹", "pink");
    await planner.addSubject("物理", "teal");
    expect(await codeOf(planner.addCategory("興趣班", "🎹", "pink"))).toBe("planner.nameTaken");
    const { categories, subjects } = await planner.options();
    const piano = categories.find((c) => c.name === "興趣班")!;
    expect(subjects.map((s) => s.name ?? s.id)).toEqual(["chinese", "english", "math", "gs", "物理"]);

    const t = await planner.create("a", { title: "鋼琴", categoryId: piano.id, date: "2026-10-27" });
    await planner.removeCategory(piano.id);
    const { categories: after } = await planner.options();
    expect(after).toHaveLength(categoriesOf(null).length);
    expect((await planner.getTask("a", t.id))?.categoryId).toBe(piano.id); // task kept (shows as "other")
  });
});
