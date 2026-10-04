import type { Entity, ISODateString, StudentScoped } from "./common";

export type DictationLanguage = "zh" | "en";

/** words = 生字 / 詞語 only; mixed = optional words + passage paragraphs (課文). */
export type DictationListType = "words" | "mixed";

export const DICTATION_LIMITS = {
  titleMaxLength: 50,
  maxItems: 100,
  itemMaxLength: 100,
  hintMaxLength: 100,
  maxParagraphs: 30,
  paragraphMaxLength: 1000,
} as const;

export interface DictationItem {
  id: string;
  /** The word / phrase / sentence to be dictated. */
  text: string;
  /** Optional meaning or hint shown after answering. */
  hint?: string;
}

/** One paragraph of a passage (課文). Practised sentence by sentence. */
export interface DictationParagraph {
  id: string;
  text: string;
}

export interface DictationList extends Entity, StudentScoped {
  /** Missing in data saved before STEP 5 — treat as "words". */
  type?: DictationListType;
  language: DictationLanguage;
  title: string;
  items: DictationItem[];
  /** Passage paragraphs (mixed lists only). */
  paragraphs?: DictationParagraph[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

/** What the user edits. `type` is only used on create — editing keeps the original type. */
export interface DictationListInput {
  type: DictationListType;
  title: string;
  /** One item per line ("text" or "text | hint"). */
  itemsText: string;
  /** Paragraph texts in order (mixed lists only). */
  paragraphs: string[];
}

export function listTypeOf(list: DictationList): DictationListType {
  return list.type ?? "words";
}

/** A single dictation step: a word, or one sentence of a passage paragraph. */
export type PracticeItemKind = "word" | "sentence";

export interface PracticeItem extends DictationItem {
  kind: PracticeItemKind;
  /** 1-based paragraph number, for sentences. */
  paragraphNumber?: number;
}
