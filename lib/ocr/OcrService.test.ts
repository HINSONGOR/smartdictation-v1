import { describe, expect, it } from "vitest";
import { cleanOcrText } from "./OcrService";

describe("cleanOcrText", () => {
  it("words: one per line, without numbering or bullets", () => {
    expect(cleanOcrText("1. apple\r\n2) banana\n\n• cherry \n- dog\n(5) egg\n3、蘋果\n①香蕉", "words")).toBe(
      "apple\nbanana\ncherry\ndog\negg\n蘋果\n香蕉",
    );
  });

  it("words: keeps hyphens and numbers inside words", () => {
    expect(cleanOcrText("ice-cream\n7-Eleven", "words")).toBe("ice-cream\n7-Eleven");
  });

  it("Chinese (普教中): drops pinyin lines and stray toned syllables", () => {
    const ocr = "chūn tiān lái le\n春天來了，\nhuā kāi le\n花開了。\n\n小鳥 xiǎo niǎo 唱歌。";
    expect(cleanOcrText(ocr, "passage", "zh")).toBe("春天來了，\n花開了。\n\n小鳥唱歌。");
    expect(cleanOcrText("1. chūn tiān\n春天\nlǜ sè\n綠色", "words", "zh")).toBe("春天\n綠色");
  });

  it("English text is left alone (no pinyin stripping)", () => {
    expect(cleanOcrText("Spring is here.", "passage", "en")).toBe("Spring is here.");
  });

  it("passage: keeps paragraphs, trims extra blank lines", () => {
    expect(cleanOcrText("  First paragraph.  \n\n\n\nSecond one.\n", "passage")).toBe("First paragraph.\n\nSecond one.");
  });
});
