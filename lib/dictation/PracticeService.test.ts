import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/data/local/keyValueStore";
import { createLocalRepositories } from "@/lib/data/local/localRepositories";
import type { Repositories } from "@/lib/data";
import { MistakeService } from "@/lib/mistakes/MistakeService";
import { MASTERY_STREAK, type DictationList, type PracticeAnswer } from "@/types";
import { PracticeService } from "./PracticeService";

const LIST: DictationList = {
  id: "list-1",
  studentId: "a",
  language: "en",
  title: "Unit 1",
  items: [
    { id: "i1", text: "apple", hint: "蘋果" },
    { id: "i2", text: "banana" },
  ],
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

const START = "2026-10-01T00:00:00.000Z";
const right = (itemId: string, text: string): PracticeAnswer => ({ itemId, text, answer: text, correct: true });
const wrong = (itemId: string, text: string, answer = "x"): PracticeAnswer => ({ itemId, text, answer, correct: false });

describe("PracticeService", () => {
  let repos: Repositories;
  let service: PracticeService;
  let mistakes: MistakeService;

  beforeEach(() => {
    repos = createLocalRepositories(new MemoryStore());
    service = new PracticeService(repos.practice, repos.mistakes);
    mistakes = new MistakeService(repos.mistakes);
  });

  const finish = (answers: PracticeAnswer[], kind: "list" | "retry" = "list") =>
    service.finish("a", { list: LIST, mode: "typing", answers, startedAt: START, kind });

  it("saves the session with score and kind", async () => {
    const { session } = await finish([right("i1", "apple"), wrong("i2", "banana", "banan")]);
    expect(session).toMatchObject({ studentId: "a", listId: "list-1", kind: "list", total: 2, correct: 1 });
    expect(await repos.practice.listByStudent("a")).toHaveLength(1);
  });

  it("records mistakes with hint, and increases the count on repeats", async () => {
    await finish([wrong("i1", "apple", "aple")]);
    await finish([wrong("i1", "apple", "appel")]);
    const records = await repos.mistakes.listByStudent("a");
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ itemId: "i1", count: 2, wrongAnswer: "appel", hint: "蘋果", correctStreak: 0 });
  });

  it("does not create records for correct answers", async () => {
    await finish([right("i1", "apple")]);
    expect(await repos.mistakes.listByStudent("a")).toEqual([]);
  });

  it("correct answers in list practice progress an existing mistake to mastery", async () => {
    await finish([wrong("i2", "banana")]);
    let result = await finish([right("i2", "banana")]);
    for (let i = 1; i < MASTERY_STREAK; i++) result = await finish([right("i2", "banana")]);
    expect(result.newlyMastered).toEqual(["banana"]);
    expect((await mistakes.overview("a")).mastered).toHaveLength(1);
  });

  it("review answers update records by id and report newly mastered words", async () => {
    await finish([wrong("i1", "apple"), wrong("i2", "banana")]);
    const items = await mistakes.reviewItems("a", "en");
    expect(items.map((i) => i.text).sort()).toEqual(["apple", "banana"]);
    expect(items.find((i) => i.text === "apple")?.hint).toBe("蘋果");

    let result;
    for (let i = 0; i < MASTERY_STREAK; i++) {
      result = await service.finishReview("a", {
        language: "en",
        mode: "typing",
        startedAt: START,
        answers: items.map((it) => (it.text === "apple" ? right(it.id, it.text) : wrong(it.id, it.text))),
      });
    }
    expect(result!.newlyMastered).toEqual(["apple"]);
    expect(result!.session).toMatchObject({ kind: "review", listId: null });

    const overview = await mistakes.overview("a", "en");
    expect(overview.active.map((r) => [r.text, r.count])).toEqual([["banana", 1 + MASTERY_STREAK]]);
    expect(overview.mastered.map((r) => r.text)).toEqual(["apple"]);
  });

  it("keeps records per student", async () => {
    await finish([wrong("i2", "banana")]);
    expect(await repos.mistakes.listByStudent("b")).toEqual([]);
    expect(await repos.practice.listByStudent("b")).toEqual([]);
    expect(await service.latestByList("b", "en")).toEqual({});
    // Student B cannot touch A's records through review either.
    const [item] = await mistakes.reviewItems("a", "en");
    await service.finishReview("b", { language: "en", mode: "typing", startedAt: START, answers: [right(item.id, item.text)] });
    expect((await repos.mistakes.listByStudent("a"))[0].correctStreak).toBe(0);
  });

  it("refuses to save a list for another student", async () => {
    await expect(service.finish("b", { list: LIST, mode: "typing", answers: [], startedAt: START })).rejects.toThrow();
  });

  it("last score only counts whole-list runs, latest wins", async () => {
    await finish([wrong("i1", "apple"), right("i2", "banana")]);
    const second = await finish([right("i1", "apple"), right("i2", "banana")]);
    await finish([right("i1", "apple")], "retry");
    const latest = await service.latestByList("a", "en");
    expect(latest["list-1"].id).toBe(second.session.id);
  });

  it("clears mastered records only", async () => {
    await finish([wrong("i1", "apple"), wrong("i2", "banana")]);
    for (let i = 0; i < MASTERY_STREAK; i++) await finish([right("i1", "apple")]);
    await mistakes.clearMastered("a");
    expect((await repos.mistakes.listByStudent("a")).map((r) => r.text)).toEqual(["banana"]);
  });
});
