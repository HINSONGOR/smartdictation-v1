import { describe, expect, it } from "vitest";
import { diffAnswer, type DiffToken } from "./answerDiff";

const wrong = (tokens: DiffToken[]) => tokens.filter((t) => !t.ok).map((t) => t.text);

describe("diffAnswer (red pen)", () => {
  it("marks wrong and missing English words", () => {
    const d = diffAnswer("if you were", "Although you are not always aware of it,", "en");
    expect(wrong(d.answer)).toEqual(["if", "were"]);
    expect(wrong(d.expected)).toEqual(["Although", "are", "not", "always", "aware", "of", "it", ","]);
  });

  it("marks only the wrong letter case and punctuation", () => {
    const d = diffAnswer("your brain is always active even at night", "Your brain is always active, even at night.", "en");
    expect(wrong(d.answer)).toEqual(["your"]);
    expect(wrong(d.expected)).toEqual(["Your", ",", "."]);
  });

  it("keeps spacing information for display", () => {
    const d = diffAnswer("Hi, Tom.", "Hi, Tom.", "en");
    expect(d.answer.map((t) => [t.text, t.spaceBefore])).toEqual([
      ["Hi", false],
      [",", false],
      ["Tom", true],
      [".", false],
    ]);
    expect(wrong(d.answer)).toEqual([]);
  });

  it("compares Chinese character by character, ignoring spaces and full/half width", () => {
    const d = diffAnswer("春天來 拉,", "春天來了，", "zh");
    expect(wrong(d.answer)).toEqual(["拉"]);
    expect(wrong(d.expected)).toEqual(["了"]);
    expect(d.expected.map((t) => t.text).join("")).toBe("春天來了，"); // shown as in the textbook
  });

  it("handles an empty answer", () => {
    const d = diffAnswer("", "apple", "en");
    expect(d.answer).toEqual([]);
    expect(wrong(d.expected)).toEqual(["apple"]);
  });
});
