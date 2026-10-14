import type { DictationLanguage } from "@/types";
import { normalizeAnswer } from "./answerCheck";

/** One piece of an answer for "red pen" marking. */
export interface DiffToken {
  text: string;
  /** false = wrong / extra (in the student's answer) or missed (in the correct answer). */
  ok: boolean;
  /** English: a space goes before this token when shown. */
  spaceBefore: boolean;
}

export interface AnswerDiff {
  answer: DiffToken[];
  expected: DiffToken[];
}

/** English: words and each punctuation mark separately (so "it" vs "it," only marks the comma). */
const EN_TOKEN = /[\p{L}\p{N}'-]+|[^\s\p{L}\p{N}]/gu;

interface Piece {
  /** As written (shown to the student, e.g. the textbook's full-width "，"). */
  text: string;
  /** Compared (typing-method differences removed, like the answer check). */
  key: string;
  spaceBefore: boolean;
}

function tokenize(text: string, language: DictationLanguage): Piece[] {
  const s = text.trim().replace(/\s+/g, " ");
  const key = (piece: string) => normalizeAnswer(piece, language);
  if (language === "zh") {
    return [...s].filter((ch) => ch !== " ").map((ch) => ({ text: ch, key: key(ch), spaceBefore: false }));
  }
  return [...s.matchAll(EN_TOKEN)].map((m) => ({
    text: m[0],
    key: key(m[0]),
    spaceBefore: m.index > 0 && s[m.index - 1] === " ",
  }));
}

/**
 * Compare the student's answer with the correct text (longest common subsequence of tokens).
 * Matching is exact (case and punctuation count), like the answer check.
 */
export function diffAnswer(answer: string, expected: string, language: DictationLanguage): AnswerDiff {
  const a = tokenize(answer, language);
  const b = tokenize(expected, language);
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i].key === b[j].key ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const aOk = new Array<boolean>(a.length).fill(false);
  const bOk = new Array<boolean>(b.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i].key === b[j].key) {
      aOk[i++] = true;
      bOk[j++] = true;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  const toTokens = (pieces: Piece[], ok: boolean[]): DiffToken[] =>
    pieces.map((p, k) => ({ text: p.text, ok: ok[k], spaceBefore: p.spaceBefore }));
  return { answer: toTokens(a, aOk), expected: toTokens(b, bOk) };
}
