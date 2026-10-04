import { describe, expect, it } from "vitest";
import { speakablePunctuation } from "./punctuationSpeech";

describe("speakablePunctuation — Chinese", () => {
  it("reads punctuation names and keeps pauses", () => {
    expect(speakablePunctuation("春天來了，花開了。", "zh")).toBe("春天來了 逗號， 花開了 句號。");
  });

  it("reads quotes, book titles, ellipsis and dashes", () => {
    expect(speakablePunctuation("他說：「你好！」", "zh")).toBe("他說 冒號： 開引號 你好 感嘆號！ 關引號");
    expect(speakablePunctuation("我讀《西遊記》……", "zh")).toBe("我讀 開書名號 西遊記 關書名號 省略號……");
    expect(speakablePunctuation("這是——秘密", "zh")).toBe("這是 破折號—— 秘密");
  });

  it("leaves words without punctuation unchanged", () => {
    expect(speakablePunctuation("蓋子", "zh")).toBe("蓋子");
  });
});

describe("speakablePunctuation — English", () => {
  it("reads common marks", () => {
    expect(speakablePunctuation("Tom has a ball.", "en")).toBe("Tom has a ball full stop.");
    expect(speakablePunctuation("Yes, I can!", "en")).toBe("Yes comma, I can exclamation mark!");
  });

  it("alternates straight double quotes between open and close", () => {
    expect(speakablePunctuation('He said, "Hi."', "en")).toBe("He said comma, open quote Hi full stop. close quote");
  });

  it("does not read decimal points or apostrophes; reads hyphens in words", () => {
    expect(speakablePunctuation("It's 3.5 m", "en")).toBe("It's 3.5 m");
    expect(speakablePunctuation("ice-cream", "en")).toBe("ice hyphen cream");
  });
});
