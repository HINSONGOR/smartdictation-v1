import type { DictationItem, DictationLanguage, DictationParagraph, PracticeItem, PracticeOptions } from "@/types";
import { splitSentences } from "./passage";

export interface PracticeSource {
  language: DictationLanguage;
  words: DictationItem[];
  paragraphs: DictationParagraph[];
}

/** Paragraph indexes chosen by the passage options (always returned in passage order). */
export function selectParagraphIndexes(
  count: number,
  options: Pick<PracticeOptions, "passageScope" | "paragraphIndex" | "randomCount">,
  random: () => number = Math.random,
): number[] {
  if (count === 0) return [];
  switch (options.passageScope) {
    case "one":
      return [Math.min(Math.max(options.paragraphIndex, 0), count - 1)];
    case "random": {
      const pool = Array.from({ length: count }, (_, i) => i);
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const take = Math.min(Math.max(options.randomCount, 1), count);
      return pool.slice(0, take).sort((a, b) => a - b);
    }
    case "all":
      return Array.from({ length: count }, (_, i) => i);
  }
}

/** Sentences of one paragraph as practice items. Ids are stable for the same paragraph text. */
export function paragraphSentences(paragraph: DictationParagraph, number: number, language: DictationLanguage): PracticeItem[] {
  return splitSentences(paragraph.text, language).map((text, i) => ({
    id: `${paragraph.id}:s${i + 1}`,
    text,
    kind: "sentence",
    paragraphNumber: number,
  }));
}

/**
 * Builds the practice queue: words first (if included), then the chosen paragraphs sentence by sentence.
 * Word order is applied later by startPractice; sentences always keep passage order.
 */
export function buildPracticeItems(
  source: PracticeSource,
  options: PracticeOptions,
  random: () => number = Math.random,
): PracticeItem[] {
  const words: PracticeItem[] =
    source.paragraphs.length === 0 || options.includeWords
      ? source.words.map((w) => ({ ...w, kind: "word" as const }))
      : [];
  const sentences = selectParagraphIndexes(source.paragraphs.length, options, random).flatMap((index) =>
    paragraphSentences(source.paragraphs[index], index + 1, source.language),
  );
  return [...words, ...sentences];
}
