import { describe, expect, it } from "vitest";
import { DEFAULT_PRACTICE_OPTIONS, type PracticeOptions } from "@/types";
import { buildPracticeItems, selectParagraphIndexes, type PracticeSource } from "./practiceItems";

const SOURCE: PracticeSource = {
  language: "zh",
  words: [
    { id: "w1", text: "春天" },
    { id: "w2", text: "花園" },
  ],
  paragraphs: [
    { id: "p1", text: "春天來了。花開了。" },
    { id: "p2", text: "小鳥唱歌。" },
    { id: "p3", text: "我們去公園。" },
  ],
};

const opts = (patch: Partial<PracticeOptions>): PracticeOptions => ({ ...DEFAULT_PRACTICE_OPTIONS, ...patch });

describe("selectParagraphIndexes", () => {
  it("one / all", () => {
    expect(selectParagraphIndexes(3, opts({ passageScope: "one", paragraphIndex: 1 }))).toEqual([1]);
    expect(selectParagraphIndexes(3, opts({ passageScope: "one", paragraphIndex: 9 }))).toEqual([2]);
    expect(selectParagraphIndexes(3, opts({ passageScope: "all" }))).toEqual([0, 1, 2]);
  });

  it("random X: distinct, clamped, in passage order", () => {
    const picked = selectParagraphIndexes(3, opts({ passageScope: "random", randomCount: 2 }), () => 0);
    expect(picked).toHaveLength(2);
    expect(new Set(picked).size).toBe(2);
    expect([...picked].sort()).toEqual(picked);
    expect(selectParagraphIndexes(3, opts({ passageScope: "random", randomCount: 10 }))).toEqual([0, 1, 2]);
  });

  it("no paragraphs → nothing", () => {
    expect(selectParagraphIndexes(0, opts({ passageScope: "all" }))).toEqual([]);
  });
});

describe("buildPracticeItems", () => {
  it("words first, then sentences of chosen paragraphs with stable ids", () => {
    const items = buildPracticeItems(SOURCE, opts({ passageScope: "one", paragraphIndex: 0 }));
    expect(items.map((i) => [i.id, i.kind, i.text])).toEqual([
      ["w1", "word", "春天"],
      ["w2", "word", "花園"],
      ["p1:s1", "sentence", "春天來了。"],
      ["p1:s2", "sentence", "花開了。"],
    ]);
    expect(items[2].paragraphNumber).toBe(1);
  });

  it("can leave out the words of a mixed list", () => {
    const items = buildPracticeItems(SOURCE, opts({ includeWords: false, passageScope: "all" }));
    expect(items.every((i) => i.kind === "sentence")).toBe(true);
    expect(items).toHaveLength(4);
  });

  it("word-only lists always include the words", () => {
    const items = buildPracticeItems({ ...SOURCE, paragraphs: [] }, opts({ includeWords: false }));
    expect(items.map((i) => i.id)).toEqual(["w1", "w2"]);
  });
});
