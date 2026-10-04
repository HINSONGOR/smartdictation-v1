import type { Entity, ISODateString, StudentScoped } from "./common";
import type { DictationLanguage, PracticeItemKind } from "./dictation";

/** Correct answers in a row needed before a mistake counts as mastered. */
export const MASTERY_STREAK = 2;

export interface MistakeRecord extends Entity, StudentScoped {
  language: DictationLanguage;
  listId: string;
  itemId: string;
  /** Correct answer. */
  text: string;
  /** word or passage sentence (missing = word). */
  kind?: PracticeItemKind;
  /** Hint copied from the list item, if any. */
  hint?: string;
  /** Most recent wrong answer, if captured. */
  wrongAnswer?: string;
  /** Total times answered wrong. */
  count: number;
  /** Correct answers in a row since the last mistake (missing in STEP 3 data = 0). */
  correctStreak?: number;
  lastMistakeAt: ISODateString;
  /** Set once correctStreak reaches MASTERY_STREAK; cleared if answered wrong again. */
  masteredAt?: ISODateString;
}
