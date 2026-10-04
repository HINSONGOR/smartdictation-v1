import type { Entity, ISODateString, StudentScoped } from "./common";
import type { DictationLanguage, PracticeItemKind } from "./dictation";

/** typing = answer is typed and checked automatically; paper = written by hand, then self-marked. */
export type PracticeMode = "typing" | "paper";
export type PracticeOrder = "sequential" | "random";
export type PracticeSpeed = "slow" | "normal";
/** Which passage paragraphs to practise: one chosen paragraph, X random ones, or all. */
export type PassageScope = "one" | "random" | "all";
/** Voice used for Chinese dictation. */
export type ChineseVoice = "cantonese" | "mandarin";

export interface PracticeOptions {
  mode: PracticeMode;
  /** Order of words (passage sentences always keep their order). */
  order: PracticeOrder;
  speed: PracticeSpeed;
  /** Mixed lists: include the word items too. */
  includeWords: boolean;
  passageScope: PassageScope;
  /** 0-based paragraph index when passageScope = "one". */
  paragraphIndex: number;
  /** Number of paragraphs when passageScope = "random". */
  randomCount: number;
}

export const DEFAULT_PRACTICE_OPTIONS: PracticeOptions = {
  mode: "paper",
  order: "sequential",
  speed: "normal",
  includeWords: true,
  passageScope: "all",
  paragraphIndex: 0,
  randomCount: 1,
};

export interface PracticeAnswer {
  itemId: string;
  /** Expected text (copied so history survives list edits). */
  text: string;
  kind?: PracticeItemKind;
  /** What the student typed (typing mode only). */
  answer?: string;
  correct: boolean;
}

/** list = a whole word list; retry = only the wrong words of a list; review = mistake review. */
export type PracticeKind = "list" | "retry" | "review";

/** One finished practice run. */
export interface PracticeSession extends Entity, StudentScoped {
  /** Missing in STEP 3 data — treat as "list". */
  kind?: PracticeKind;
  /** null for mistake review sessions. */
  listId: string | null;
  language: DictationLanguage;
  mode: PracticeMode;
  total: number;
  correct: number;
  answers: PracticeAnswer[];
  startedAt: ISODateString;
  finishedAt: ISODateString;
}
