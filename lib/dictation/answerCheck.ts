import type { DictationLanguage } from "@/types";

/**
 * Normalise an answer for comparison. Follows the textbook strictly:
 * letter case and punctuation must match. Only typing-method differences are ignored:
 *  - NFKC (full-width ↔ half-width letters / punctuation), smart quotes → plain quotes
 *  - leading / trailing spaces
 *  - zh: all spaces; en: repeated spaces count as one
 */
export function normalizeAnswer(text: string, language: DictationLanguage): string {
  const s = text
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
  return language === "zh" ? s.replace(/\s+/g, "") : s.replace(/\s+/g, " ");
}

export function isAnswerCorrect(answer: string, expected: string, language: DictationLanguage): boolean {
  const a = normalizeAnswer(answer, language);
  return a.length > 0 && a === normalizeAnswer(expected, language);
}
