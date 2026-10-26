import { beforeEach, describe, expect, it } from "vitest";
import type { Repositories } from "@/lib/data";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import { ServiceError } from "@/lib/errors";
import type { PracticeSession, StudentTask } from "@/types";
import { PlannerService } from "./PlannerService";
import { addDays, autoDoneAt, categoriesOf, checkInStreak, occurrenceDays, occurrenceId, repeatsOn, dayStatus, daysBetween, examsView, isDateKey, lastDays, monthGrid, schoolYearOf, todayView, weekOf } from "./plannerRules";

const T = "2026-10-26T00:00:00.000Z";
const codeOf = (p: Promise<unknown>) => p.then(() => null, (e: unknown) => (e instanceof ServiceError ? e.code : String(e)));
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

  it("computes day status, the week and the check-in streak (days without tasks are skipped)", () => {
    const tasks = [
      task({ id: "1", date: "2026-10-20", done: true }), // Tue: all
      task({ id: "2", date: "2026-10-22", done: true }), // Thu: all (Wed empty)
      task({ id: "3", date: "2026-10-23", done: true }), // Fri: all
      task({ id: "4", date: "2026-10-26", done: true }), // Mon (today): some
      task({ id: "5", date: "2026-10-26" }),
      task({ id: "6", date: "2026-10-27" }),
    ];
    expect(lastDays("2026-10-28", 7)).toEqual(["2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27", "2026-10-28"]);
    expect(weekOf("2026-10-28")[0]).toBe("2026-10-26");
    expect(weekOf("2026-10-28")[6]).toBe("2026-11-01");
    expect(["2026-10-21", "2026-10-22", "2026-10-26", "2026-10-27"].map((d) => dayStatus(tasks, d, "2026-10-26"))).toEqual([
      "empty", "all", "some", "future",
    ]);
    expect(checkInStreak(tasks, "2026-10-26")).toBe(3); // today not finished yet: doesn't break it
    expect(checkInStreak([...tasks.slice(0, 4), { ...tasks[4], done: true }], "2026-10-26")).toBe(4);
    expect(checkInStreak([task({ date: "2026-10-25" })], "2026-10-26")).toBe(0);
  });

  it("lists exams with their revision progress", () => {
    const exam = task({ id: "e", categoryId: "exam", date: "2026-11-03" });
    const old = task({ id: "o", categoryId: "dictation", date: "2026-10-20" });
    const view = examsView(
      [exam, old, task({ id: "r1", categoryId: "revision", examId: "e", done: true }), task({ id: "r2", categoryId: "revision", examId: "e" }), task({ id: "h" })],
      "2026-10-26",
    );
    expect(view.upcoming.map((c) => [c.exam.id, c.days, c.revisionDone, c.revision.length])).toEqual([["e", 8, 1, 2]]);
    expect(view.past.map((c) => c.exam.id)).toEqual(["o"]);
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

  it("creates many tasks at once, or none if one is invalid", async () => {
    const ok = { title: "交回條", categoryId: "notice", date: "2026-11-07" };
    expect(await codeOf(planner.createMany("a", [ok, { ...ok, date: "bad" }]))).toBe("task.dateInvalid");
    expect(await planner.listTasks("a")).toEqual([]);
    const [notice, exam, revision] = await planner.createMany("a", [
      ok,
      { ...ok, title: "中文測驗", categoryId: "exam", ref: "e1" },
      { ...ok, title: "溫習：第3課", categoryId: "revision", examRef: "e1" },
    ]);
    expect(await planner.listTasks("a")).toHaveLength(3);
    expect(revision.examId).toBe(exam.id);
    expect(notice.examId).toBeUndefined();
    expect("ref" in exam || "examRef" in revision).toBe(false); // batch names are not stored
  });

  it("keeps an exam's scope (trimmed, empty parts dropped) and clears it when emptied", async () => {
    const exam = await planner.create("a", { title: "中文測驗", categoryId: "exam", date: "2026-11-13", scope: [" 第3課 ", "", "第4課"] });
    expect(exam.scope).toEqual(["第3課", "第4課"]);
    const cleared = await planner.update("a", exam.id, { title: "中文測驗", categoryId: "exam", date: "2026-11-13", scope: [] });
    expect(cleared.scope).toBeUndefined();
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

describe("repeating tasks", () => {
  const MON = "2026-10-26";
  let repos: Repositories;
  let planner: PlannerService;
  const base = { title: "Homework", categoryId: "homework", date: MON, minutes: 60 };
  const dates = (tasks: StudentTask[]) => tasks.map((t) => t.date).sort();

  beforeEach(() => {
    repos = createLocalRepositories(new MemoryStore());
    planner = new PlannerService(repos.tasks, repos.planner, repos.practice, repos.content);
  });

  it("knows which days each repeat kind falls on", () => {
    const rule = { kind: "weekly" as const, weekdays: [2, 4], start: MON };
    expect(repeatsOn(rule, "2026-10-27")).toBe(true); // Tue
    expect(repeatsOn(rule, "2026-10-28")).toBe(false);
    expect(repeatsOn({ kind: "schoolDays", start: MON }, "2026-11-01")).toBe(false); // Sun
    expect(repeatsOn({ kind: "daily", start: MON, end: "2026-10-30" }, "2026-10-31")).toBe(false);
    expect(repeatsOn({ kind: "daily", start: MON, pausedUntil: "2026-10-28" }, "2026-10-28")).toBe(false);
    expect(repeatsOn({ kind: "daily", start: MON, skip: ["2026-10-29"] }, "2026-10-29")).toBe(false);
    expect(occurrenceDays({ kind: "schoolDays", start: MON }, "2026-10-01", "2026-11-08")).toHaveLength(10);
  });

  it("creates each school day's task for two weeks, hides the template, never duplicates", async () => {
    const template = await planner.create("a", { ...base, repeat: { kind: "schoolDays" } });
    const first = await planner.listTasks("a", MON);
    expect(first).toHaveLength(10);
    expect(first.every((t) => t.routineId === template.id && t.minutes === 60 && !t.repeat)).toBe(true);
    expect(first.map((t) => t.id)).toContain(occurrenceId(template.id, MON));
    expect(await planner.listTasks("a", MON)).toHaveLength(10); // no duplicates
    expect(await planner.listTasks("a", "2026-10-28")).toHaveLength(12); // the window moves on
    expect(await codeOf(planner.create("a", { ...base, repeat: { kind: "weekly", weekdays: [] } }))).toBe("task.weekdaysRequired");
  });

  it("skips one day, or stops from a day on, when a day's task is deleted", async () => {
    await planner.create("a", { ...base, repeat: { kind: "daily" } });
    let tasks = await planner.listTasks("a", MON);
    await planner.remove("a", tasks.find((t) => t.date === "2026-10-27")!.id, "one");
    tasks = await planner.listTasks("a", MON);
    expect(dates(tasks)).not.toContain("2026-10-27");
    expect(tasks).toHaveLength(13);

    await planner.remove("a", tasks.find((t) => t.date === "2026-10-30")!.id, "future");
    expect(dates(await planner.listTasks("a", MON))).toEqual(["2026-10-26", "2026-10-28", "2026-10-29"]);
  });

  it("changes this day and later (days already done keep their state)", async () => {
    await planner.create("a", { ...base, repeat: { kind: "schoolDays" } });
    let tasks = await planner.listTasks("a", MON);
    await planner.setDone("a", tasks.find((t) => t.date === MON)!.id, true);
    const tue = tasks.find((t) => t.date === "2026-10-27")!;
    await planner.update("a", tue.id, { ...base, title: "Homework + reading", date: tue.date, repeat: { kind: "schoolDays" } }, "future");
    tasks = await planner.listTasks("a", MON);
    expect(tasks.find((t) => t.date === MON)).toMatchObject({ title: "Homework", done: true });
    expect(tasks.filter((t) => t.date >= "2026-10-27").every((t) => t.title === "Homework + reading")).toBe(true);
    expect(tasks).toHaveLength(10);

    // From a later day: the days before it keep their old details; a day already ticked moves along.
    const thu = tasks.find((t) => t.date === "2026-10-29")!;
    await planner.setDone("a", thu.id, true);
    const fri = tasks.find((t) => t.date === "2026-10-30")!;
    await planner.update("a", fri.id, { ...base, title: "Homework (short)", minutes: 30, date: fri.date, repeat: { kind: "schoolDays" } }, "future");
    await planner.update("a", tasks.find((t) => t.date === "2026-10-28")!.id, { ...base, title: "Wed", date: "2026-10-28", repeat: { kind: "schoolDays" } }, "future");
    tasks = await planner.listTasks("a", MON);
    const titleOn = (d: string) => tasks.find((t) => t.date === d)?.title;
    expect(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-11-06"].map(titleOn)).toEqual([
      "Homework", "Homework + reading", "Wed", "Wed", "Homework (short)", "Homework (short)",
    ]);
    expect(tasks.find((t) => t.date === "2026-10-29")?.done).toBe(true); // tick kept
    expect(tasks).toHaveLength(10); // no duplicates

    // Only one day.
    const wed = tasks.find((t) => t.date === "2026-10-28")!;
    await planner.update("a", wed.id, { ...base, title: "No reading today", date: wed.date }, "one");
    tasks = await planner.listTasks("a", MON);
    expect(tasks.filter((t) => t.title === "No reading today").map((t) => t.date)).toEqual(["2026-10-28"]);
  });

  it("pauses for holidays and carries on afterwards", async () => {
    const template = await planner.create("a", { ...base, repeat: { kind: "daily" } });
    await planner.listTasks("a", MON);
    await planner.pauseRoutine("a", template.id, "2026-10-31", MON);
    expect(dates(await planner.listTasks("a", MON))[0]).toBe("2026-11-01");
    await planner.pauseRoutine("a", template.id, null, MON);
    expect(await planner.listTasks("a", MON)).toHaveLength(14);
  });

  it("turns a normal task into a repeating one, and back", async () => {
    const once = await planner.create("a", base);
    const template = await planner.update("a", once.id, { ...base, repeat: { kind: "weekly", weekdays: [1] } });
    expect(template.repeat).toMatchObject({ kind: "weekly", weekdays: [1], start: MON });
    let tasks = await planner.listTasks("a", MON);
    expect(dates(tasks)).toEqual(["2026-10-26", "2026-11-02"]);

    await planner.update("a", tasks.find((t) => t.date === "2026-11-02")!.id, { ...base, date: "2026-11-02" }, "future");
    tasks = await planner.listTasks("a", MON);
    expect(dates(tasks)).toEqual(["2026-10-26", "2026-11-02"]);
    expect(tasks.find((t) => t.date === "2026-11-02")?.routineId).toBeUndefined(); // now a normal task
    expect(await planner.listTasks("a", "2026-11-09")).toHaveLength(2); // repeat ended
  });
});
