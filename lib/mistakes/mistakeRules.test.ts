import { describe, expect, it } from "vitest";
import { MASTERY_STREAK, type MistakeRecord } from "@/types";
import { applyCorrect, applyWrong, isMastered } from "./mistakeRules";

const base: MistakeRecord = {
  id: "m1",
  studentId: "a",
  language: "zh",
  listId: "l1",
  itemId: "i1",
  text: "蓋子",
  count: 1,
  correctStreak: 0,
  lastMistakeAt: "2026-10-01T00:00:00.000Z",
};

describe("mistake rules", () => {
  it(`masters a word after ${MASTERY_STREAK} correct answers in a row`, () => {
    let r = base;
    for (let i = 0; i < MASTERY_STREAK - 1; i++) r = applyCorrect(r, "t");
    expect(isMastered(r)).toBe(false);
    r = applyCorrect(r, "t-mastered");
    expect(r.masteredAt).toBe("t-mastered");
    expect(applyCorrect(r, "later")).toBe(r); // no further change once mastered
  });

  it("a wrong answer resets the streak, counts up and un-masters", () => {
    const mastered = { ...base, correctStreak: MASTERY_STREAK, masteredAt: "t" };
    const r = applyWrong(mastered, "t2", " 盖子 ");
    expect(r).toMatchObject({ count: 2, correctStreak: 0, lastMistakeAt: "t2", wrongAnswer: "盖子" });
    expect(isMastered(r)).toBe(false);
  });

  it("treats a missing streak (STEP 3 data) as 0", () => {
    const old = { ...base };
    delete old.correctStreak;
    expect(applyCorrect(old, "t").correctStreak).toBe(1);
  });
});
