import { describe, expect, it } from "vitest";
import { isAnswerCorrect, normalizeAnswer } from "./answerCheck";

describe("isAnswerCorrect — English (follows the textbook)", () => {
  it("is case-sensitive", () => {
    expect(isAnswerCorrect("apple", "apple", "en")).toBe(true);
    expect(isAnswerCorrect("Apple", "apple", "en")).toBe(false);
    expect(isAnswerCorrect("tom has a ball.", "Tom has a ball.", "en")).toBe(false);
  });

  it("requires the punctuation", () => {
    expect(isAnswerCorrect("Tom has a ball", "Tom has a ball.", "en")).toBe(false);
    expect(isAnswerCorrect("Tom has a ball.", "Tom has a ball.", "en")).toBe(true);
  });

  it("ignores outer spaces, repeated spaces and iOS smart quotes", () => {
    expect(isAnswerCorrect("  ice   cream ", "ice cream", "en")).toBe(true);
    expect(isAnswerCorrect("don’t", "don't", "en")).toBe(true);
    expect(isAnswerCorrect("“Hi!” said Tom.", '"Hi!" said Tom.', "en")).toBe(true);
  });

  it("rejects misspellings and empty answers", () => {
    expect(isAnswerCorrect("aple", "apple", "en")).toBe(false);
    expect(isAnswerCorrect("   ", "apple", "en")).toBe(false);
    expect(isAnswerCorrect("", "", "en")).toBe(false);
  });
});

describe("isAnswerCorrect — Chinese", () => {
  it("requires punctuation, ignores spaces", () => {
    expect(isAnswerCorrect(" 春天 來了 。", "春天來了。", "zh")).toBe(true);
    expect(isAnswerCorrect("春天來了", "春天來了。", "zh")).toBe(false);
  });

  it("accepts half-width or full-width commas alike", () => {
    expect(isAnswerCorrect("你好,我是小明。", "你好，我是小明。", "zh")).toBe(true);
  });

  it("is strict about characters", () => {
    expect(isAnswerCorrect("盖子", "蓋子", "zh")).toBe(false);
    expect(isAnswerCorrect("蓋", "蓋子", "zh")).toBe(false);
  });

  it("normalises full-width letters but keeps case", () => {
    expect(normalizeAnswer("ＡＢＣ", "en")).toBe("ABC");
  });
});
