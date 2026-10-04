import { MASTERY_STREAK, type MistakeRecord } from "@/types";

export function isMastered(record: MistakeRecord): boolean {
  return record.masteredAt !== undefined;
}

/** A wrong answer: count up, reset the streak, and un-master the word. */
export function applyWrong(record: MistakeRecord, at: string, wrongAnswer?: string): MistakeRecord {
  const next: MistakeRecord = {
    ...record,
    count: record.count + 1,
    correctStreak: 0,
    lastMistakeAt: at,
  };
  delete next.masteredAt;
  if (wrongAnswer?.trim()) next.wrongAnswer = wrongAnswer.trim();
  return next;
}

/** A correct answer: extend the streak; master the word once the streak is long enough. */
export function applyCorrect(record: MistakeRecord, at: string): MistakeRecord {
  if (isMastered(record)) return record;
  const correctStreak = (record.correctStreak ?? 0) + 1;
  return correctStreak >= MASTERY_STREAK ? { ...record, correctStreak, masteredAt: at } : { ...record, correctStreak };
}
