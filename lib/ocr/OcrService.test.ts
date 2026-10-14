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

  it("passage: keeps paragraphs, trims extra blank lines", () => {
    expect(cleanOcrText("  First paragraph.  \n\n\n\nSecond one.\n", "passage")).toBe("First paragraph.\n\nSecond one.");
  });
});
