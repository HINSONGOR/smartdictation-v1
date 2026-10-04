import { describe, expect, it } from "vitest";
import type { PracticeItem } from "@/types";
import {
  currentAnswer,
  currentItem,
  groupItems,
  groupRange,
  isGroupEnd,
  itemAfterGroup,
  practiceReducer,
  startPractice,
  summarize,
  type PracticeAction,
  type PracticeState,
} from "./practiceSession";

const ITEMS: PracticeItem[] = [
  { id: "1", text: "apple", kind: "word" },
  { id: "2", text: "banana", kind: "word" },
  { id: "3", text: "orange", kind: "word" },
];

function run(state: PracticeState, actions: PracticeAction[]) {
  return actions.reduce(practiceReducer, state);
}

describe("typing mode", () => {
  const start = () => startPractice(ITEMS, { language: "en", mode: "typing", order: "sequential" });

  it("checks each answer (case-sensitive) and finishes after the last item", () => {
    const end = run(start(), [
      { type: "submit", answer: "apple" },
      { type: "next" },
      { type: "submit", answer: "Banana" },
      { type: "next" },
      { type: "submit", answer: "orange" },
      { type: "next" },
    ]);
    expect(end.phase).toBe("done");
    const summary = summarize(end);
    expect(summary).toMatchObject({ total: 3, correct: 2 });
    expect(summary.wrong).toEqual([{ itemId: "2", text: "banana", kind: "word", answer: "Banana", correct: false }]);
  });

  it("shows feedback before moving on, and ignores out-of-phase actions", () => {
    let s = practiceReducer(start(), { type: "next" });
    expect(s.index).toBe(0);
    expect(practiceReducer(s, { type: "reveal" })).toBe(s); // reveal is paper-only
    s = practiceReducer(s, { type: "submit", answer: "apple" });
    expect(s.phase).toBe("feedback");
    expect(practiceReducer(s, { type: "submit", answer: "x" })).toBe(s);
    s = practiceReducer(s, { type: "next" });
    expect(s).toMatchObject({ index: 1, phase: "question" });
    expect(currentItem(s).text).toBe("banana");
  });
});

describe("paper mode: reveal + self-mark per item", () => {
  const start = () => startPractice(ITEMS, { language: "en", mode: "paper", order: "sequential" });

  it("needs a reveal and a mark before moving on", () => {
    let s = start();
    expect(practiceReducer(s, { type: "next" })).toBe(s);
    expect(practiceReducer(s, { type: "selfMark", correct: true })).toBe(s); // must reveal first
    s = practiceReducer(s, { type: "reveal" });
    expect(s.phase).toBe("revealed");
    expect(practiceReducer(s, { type: "next" })).toBe(s); // not marked yet
    s = practiceReducer(s, { type: "selfMark", correct: true });
    s = practiceReducer(s, { type: "selfMark", correct: false }); // can change mind
    expect(s.answers).toHaveLength(1);
    expect(currentAnswer(s)?.correct).toBe(false);
    s = practiceReducer(s, { type: "next" });
    expect(s).toMatchObject({ index: 1, phase: "question" });
  });

  it("finishes after the last mark", () => {
    const end = run(start(), [
      { type: "reveal" }, { type: "selfMark", correct: true }, { type: "next" },
      { type: "reveal" }, { type: "selfMark", correct: true }, { type: "next" },
      { type: "reveal" }, { type: "selfMark", correct: false }, { type: "next" },
    ]);
    expect(end.phase).toBe("done");
    expect(summarize(end)).toMatchObject({ total: 3, correct: 2, wrong: [{ itemId: "3" }] });
  });
});

describe("paper mode: a paragraph is dictated sentence by sentence, then revealed as a whole", () => {
  const PASSAGE: PracticeItem[] = [
    { id: "w1", text: "春天", kind: "word" },
    { id: "p1:s1", text: "春天來了，", kind: "sentence", paragraphNumber: 1 },
    { id: "p1:s2", text: "花開了。", kind: "sentence", paragraphNumber: 1 },
    { id: "p1:s3", text: "蝴蝶飛來了。", kind: "sentence", paragraphNumber: 1 },
    { id: "p2:s1", text: "小鳥唱歌。", kind: "sentence", paragraphNumber: 2 },
  ];
  const start = () => startPractice(PASSAGE, { language: "zh", mode: "paper", order: "sequential" });
  const toFirstSentence = () =>
    run(start(), [{ type: "reveal" }, { type: "selfMark", correct: true }, { type: "next" }]);

  it("groups consecutive sentences of a paragraph", () => {
    const s = toFirstSentence();
    expect(currentItem(s).id).toBe("p1:s1");
    expect(groupRange(s)).toEqual([1, 3]);
    expect(groupItems(s).map((i) => i.id)).toEqual(["p1:s1", "p1:s2", "p1:s3"]);
    expect(isGroupEnd(s)).toBe(false);
  });

  it("cannot reveal before the last sentence; next / previous move inside the paragraph", () => {
    let s = toFirstSentence();
    expect(practiceReducer(s, { type: "reveal" })).toBe(s);
    expect(practiceReducer(s, { type: "previous" })).toBe(s); // already first sentence
    s = run(s, [{ type: "next" }, { type: "next" }]);
    expect(currentItem(s).id).toBe("p1:s3");
    expect(isGroupEnd(s)).toBe(true);
    expect(practiceReducer(s, { type: "next" })).toBe(s); // must reveal at the end
    s = practiceReducer(s, { type: "previous" });
    expect(currentItem(s).id).toBe("p1:s2");
    expect(s.phase).toBe("question");
  });

  it("reveals the whole paragraph and needs every sentence marked before moving on", () => {
    let s = run(toFirstSentence(), [{ type: "next" }, { type: "next" }, { type: "reveal" }]);
    expect(s.phase).toBe("revealed");
    s = practiceReducer(s, { type: "selfMark", itemId: "p1:s1", correct: true });
    s = practiceReducer(s, { type: "selfMark", itemId: "p1:s2", correct: false });
    expect(practiceReducer(s, { type: "next" })).toBe(s); // p1:s3 not marked yet
    expect(practiceReducer(s, { type: "selfMark", itemId: "p2:s1", correct: true })).toBe(s); // outside group
    s = practiceReducer(s, { type: "selfMark", itemId: "p1:s3", correct: true });
    expect(itemAfterGroup(s)?.id).toBe("p2:s1");
    s = practiceReducer(s, { type: "next" });
    expect(currentItem(s).id).toBe("p2:s1");
    expect(s.phase).toBe("question");
  });

  it("records one answer per sentence", () => {
    const end = run(toFirstSentence(), [
      { type: "next" }, { type: "next" }, { type: "reveal" },
      { type: "selfMark", itemId: "p1:s1", correct: true },
      { type: "selfMark", itemId: "p1:s2", correct: false },
      { type: "selfMark", itemId: "p1:s3", correct: true },
      { type: "next" },
      { type: "reveal" }, { type: "selfMark", correct: true }, { type: "next" },
    ]);
    expect(end.phase).toBe("done");
    expect(summarize(end)).toMatchObject({ total: 5, correct: 4, wrong: [{ itemId: "p1:s2", kind: "sentence" }] });
  });

  it("selfMarkAll marks the whole paragraph in one step (and can be overridden per sentence)", () => {
    let s = run(toFirstSentence(), [{ type: "next" }, { type: "next" }, { type: "reveal" }, { type: "selfMarkAll", correct: true }]);
    expect(groupItems(s).every((i) => s.answers.find((a) => a.itemId === i.id)?.correct)).toBe(true);
    s = practiceReducer(s, { type: "selfMark", itemId: "p1:s2", correct: false });
    expect(s.answers.filter((a) => a.itemId.startsWith("p1:"))).toHaveLength(3);
    expect(practiceReducer(toFirstSentence(), { type: "selfMarkAll", correct: true }).answers).toHaveLength(1); // not revealed: no-op beyond the word
  });

  it("typing mode keeps checking sentence by sentence (no grouping)", () => {
    const s = startPractice(PASSAGE, { language: "zh", mode: "typing", order: "sequential" });
    const atSentence = run(s, [{ type: "submit", answer: "春天" }, { type: "next" }]);
    expect(groupRange(atSentence)).toEqual([1, 1]);
  });
});

describe("order", () => {
  const MIXED: PracticeItem[] = [
    ...ITEMS,
    { id: "p1:s1", text: "First.", kind: "sentence", paragraphNumber: 1 },
    { id: "p1:s2", text: "Second.", kind: "sentence", paragraphNumber: 1 },
  ];

  it("random shuffles words only; sentences stay in order after the words", () => {
    const values = [0.1, 0.9, 0.5];
    let n = 0;
    const s = startPractice(MIXED, { language: "en", mode: "typing", order: "random" }, () => values[n++ % 3]);
    const ids = s.items.map((i) => i.id);
    expect(ids.slice(0, 3).sort()).toEqual(["1", "2", "3"]);
    expect(ids.slice(0, 3)).not.toEqual(["1", "2", "3"]);
    expect(ids.slice(3)).toEqual(["p1:s1", "p1:s2"]);
  });

  it("refuses an empty list", () => {
    expect(() => startPractice([], { language: "zh", mode: "typing", order: "sequential" })).toThrow();
  });
});
