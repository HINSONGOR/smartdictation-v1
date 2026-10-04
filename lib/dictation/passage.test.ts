import { describe, expect, it } from "vitest";
import { autoSplitParagraphs, splitSentences } from "./passage";

describe("autoSplitParagraphs", () => {
  it("uses blank lines as paragraph breaks, joins wrapped lines, one sentence per line", () => {
    const text = "春天來了，\n花開了。\n\n小鳥在唱歌。\r\n\r\n我們去公園。";
    expect(autoSplitParagraphs(text, "zh")).toEqual(["春天來了，\n花開了。", "小鳥在唱歌。", "我們去公園。"]);
  });

  it("without blank lines, breaks paragraphs after sentence-ending lines and joins wrapped ones", () => {
    const text = "春天來了，花園裏的\n花都開了。\n小鳥在樹上唱歌：「早晨！」";
    expect(autoSplitParagraphs(text, "zh")).toEqual(["春天來了，\n花園裏的花都開了。", "小鳥在樹上唱歌：「早晨！」"]);
  });

  it("starts a new paragraph at an indented line", () => {
    const text = "　　第一段，\n　　第二段。";
    expect(autoSplitParagraphs(text, "zh")).toEqual(["第一段，", "第二段。"]);
  });

  it("removes PDF spaces between Chinese characters but keeps English words apart", () => {
    expect(autoSplitParagraphs("我 喜 歡 Apple 手 機 。", "zh")).toEqual(["我喜歡 Apple 手機。"]);
  });

  it("joins wrapped English lines with a space and splits sentences / clauses", () => {
    const text = "Tom has a red\nball. Yes, he likes it.\nMay has a cat.";
    expect(autoSplitParagraphs(text, "en")).toEqual(["Tom has a red ball.\nYes,\nhe likes it.", "May has a cat."]);
  });

  it("ignores empty input", () => {
    expect(autoSplitParagraphs("  \n \n", "zh")).toEqual([]);
  });
});

describe("splitSentences", () => {
  it("splits Chinese at 。！？，； but not at ：、 or inside quotes", () => {
    expect(splitSentences("春天來了，花開了；小鳥說：「你好。」蘋果、香蕉都好吃！你呢？好", "zh")).toEqual([
      "春天來了，",
      "花開了；",
      "小鳥說：「你好。」",
      "蘋果、香蕉都好吃！",
      "你呢？",
      "好",
    ]);
  });

  it("splits English at . ! ? before a capital, and at , ; before a space", () => {
    expect(splitSentences('It costs 3,000 or 3.5 dollars. "Wow!" said Tom, then left; ok', "en")).toEqual([
      "It costs 3,000 or 3.5 dollars.",
      '"Wow!" said Tom,',
      "then left;",
      "ok",
    ]);
  });

  it("treats line breaks as manual splits", () => {
    expect(splitSentences("春天來了\n花開了。", "zh")).toEqual(["春天來了", "花開了。"]);
  });

  it("returns the whole text when there is no punctuation", () => {
    expect(splitSentences("I like apples", "en")).toEqual(["I like apples"]);
  });
});
