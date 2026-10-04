import type { DictationLanguage } from "@/types";

const CJK = "\\u3000-\\u303f\\u3400-\\u9fff\\uf900-\\ufaff\\uff00-\\uffef";
/** Spaces between two CJK characters / full-width punctuation (typical PDF copy artefact). */
const SPACE_BETWEEN_CJK = new RegExp(`([${CJK}])\\s+(?=[${CJK}])`, "g");
/** A line ending like this probably ends a paragraph. */
const PARAGRAPH_END = /[。！？!?.…」』”"）)]$/;
/** A line starting with an indent (full-width or 2+ spaces) starts a new paragraph. */
const INDENTED = /^(　|\s{2,})/;

function tidy(text: string, language: DictationLanguage): string {
  const collapsed = text.replace(/[ \t ]+/g, " ").trim();
  return language === "zh" ? collapsed.replace(SPACE_BETWEEN_CJK, "$1") : collapsed;
}

/**
 * Split pasted passage text into paragraphs (best effort — the user must review the result).
 *  - Blank lines separate paragraphs, when present.
 *  - Otherwise a new paragraph starts after a line ending with sentence punctuation,
 *    or at an indented line; other line breaks are treated as wrapping and joined.
 */
export function autoSplitParagraphs(raw: string, language: DictationLanguage): string[] {
  // Show the automatic sentence split inside each paragraph: one sentence per line, for the user to check.
  return groupParagraphs(raw, language)
    .map((p) => tidy(p, language))
    .filter(Boolean)
    .map((p) => splitSentences(p, language).join("\n"));
}

function groupParagraphs(raw: string, language: DictationLanguage): string[] {
  const text = raw.replace(/\r\n?/g, "\n");
  const joiner = language === "zh" ? "" : " ";

  if (/\n[ \t　]*\n/.test(text)) {
    return text.split(/\n[ \t　]*\n/).map((block) => block.split("\n").map((l) => l.trim()).join(joiner));
  }

  const paragraphs: string[] = [];
  let current = "";
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const startsNew = current === "" || PARAGRAPH_END.test(current) || INDENTED.test(rawLine);
    if (startsNew) {
      if (current) paragraphs.push(current);
      current = line;
    } else {
      current += joiner + line;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs;
}

/** Sentence-ending marks: always split (English only before a capital / digit). */
const SENTENCE_END: Record<DictationLanguage, string> = { zh: "。！？!?", en: ".!?" };
/** Clause marks: also split (English only when followed by a space, so "3,000" stays together). */
const CLAUSE_END: Record<DictationLanguage, string> = { zh: "，,；;", en: ",;" };
const CLOSERS = "」』”’）)\"'";

function splitLine(line: string, language: DictationLanguage): string[] {
  const ends = SENTENCE_END[language] + CLAUSE_END[language];
  const text = line.trim();
  const sentences: string[] = [];
  let start = 0;
  let i = 0;
  while (i < text.length) {
    if (!ends.includes(text[i])) {
      i++;
      continue;
    }
    const isClause = CLAUSE_END[language].includes(text[i]);
    let j = i + 1;
    while (j < text.length && ends.includes(text[j])) j++;
    while (j < text.length && CLOSERS.includes(text[j])) j++;
    const rest = text.slice(j);
    const boundary =
      language === "zh" ||
      rest.trim() === "" ||
      (isClause ? /^\s/.test(rest) : /^\s+["'“‘(]?[A-Z0-9]/.test(rest));
    if (boundary) {
      sentences.push(text.slice(start, j).trim());
      start = j;
    }
    i = j;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}

/**
 * Split a paragraph into dictation sentences ("句"): at 。！？，； (English . ! ? , ;) and at line breaks
 * (so the user can split by hand). Colons, 、 and quotes don't split; closing quotes stay with their sentence.
 */
export function splitSentences(paragraph: string, language: DictationLanguage): string[] {
  return paragraph
    .split(/\n+/)
    .flatMap((line) => splitLine(line, language))
    .filter(Boolean);
}
