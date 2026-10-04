import type { MistakeRepository, PracticeRepository } from "@/lib/data";
import { applyCorrect, applyWrong, isMastered } from "@/lib/mistakes/mistakeRules";
import { createId, nowIso } from "@/lib/utils/id";
import type {
  DictationLanguage,
  DictationList,
  MistakeRecord,
  PracticeAnswer,
  PracticeKind,
  PracticeMode,
  PracticeSession,
} from "@/types";

interface FinishBase {
  mode: PracticeMode;
  answers: PracticeAnswer[];
  startedAt: string;
}

export interface FinishPracticeInput extends FinishBase {
  list: DictationList;
  /** "list" = whole list (counts as "last score"), "retry" = wrong words only. Default "list". */
  kind?: "list" | "retry";
}

/** Review answers use the mistake record id as itemId. */
export interface FinishReviewInput extends FinishBase {
  language: DictationLanguage;
}

export interface FinishResult {
  session: PracticeSession;
  /** Texts of words that became mastered in this run. */
  newlyMastered: string[];
}

/** Saves finished practice runs and keeps the student's mistake records up to date. */
export class PracticeService {
  constructor(
    private readonly practice: PracticeRepository,
    private readonly mistakes: MistakeRepository,
  ) {}

  /** Practice of a word list: records new mistakes, and progresses existing ones. */
  async finish(studentId: string, input: FinishPracticeInput): Promise<FinishResult> {
    const { list } = input;
    if (list.studentId !== studentId) throw new Error("List does not belong to this student");

    const session = await this.saveSession(studentId, input.kind ?? "list", list.id, list.language, input);
    const existing = await this.mistakes.listByStudent(studentId, list.language);
    const hintById = new Map(list.items.map((i) => [i.id, i.hint]));

    const newlyMastered = await this.applyAnswers(input.answers, session.finishedAt, (answer) => {
      const record = existing.find((m) => m.listId === list.id && m.itemId === answer.itemId);
      if (record || answer.correct) return record ?? null;
      const created: MistakeRecord = {
        id: createId(),
        studentId,
        language: list.language,
        listId: list.id,
        itemId: answer.itemId,
        text: answer.text,
        kind: answer.kind ?? "word",
        count: 0, // applyWrong adds the first mistake
        correctStreak: 0,
        lastMistakeAt: session.finishedAt,
      };
      const hint = hintById.get(answer.itemId);
      if (hint) created.hint = hint;
      return created;
    });
    return { session, newlyMastered };
  }

  /** Mistake review: every answer belongs to an existing mistake record. */
  async finishReview(studentId: string, input: FinishReviewInput): Promise<FinishResult> {
    const session = await this.saveSession(studentId, "review", null, input.language, input);
    const records = await this.mistakes.listByStudent(studentId, input.language);
    const newlyMastered = await this.applyAnswers(
      input.answers,
      session.finishedAt,
      (answer) => records.find((m) => m.id === answer.itemId) ?? null,
    );
    return { session, newlyMastered };
  }

  /** Latest whole-list session per list, for the "last score" on the list page. */
  async latestByList(studentId: string, language: DictationLanguage): Promise<Record<string, PracticeSession>> {
    const latest: Record<string, PracticeSession> = {};
    // Sessions come back in save order, so ">=" lets the later one win timestamp ties.
    for (const session of await this.practice.listByStudent(studentId, language)) {
      if ((session.kind ?? "list") !== "list" || !session.listId) continue;
      const current = latest[session.listId];
      if (!current || session.finishedAt >= current.finishedAt) latest[session.listId] = session;
    }
    return latest;
  }

  private async saveSession(
    studentId: string,
    kind: PracticeKind,
    listId: string | null,
    language: DictationLanguage,
    { mode, answers, startedAt }: FinishBase,
  ): Promise<PracticeSession> {
    const session: PracticeSession = {
      id: createId(),
      studentId,
      kind,
      listId,
      language,
      mode,
      total: answers.length,
      correct: answers.filter((a) => a.correct).length,
      answers,
      startedAt,
      finishedAt: nowIso(),
    };
    await this.practice.save(session);
    return session;
  }

  /** Applies mastery rules to the record each answer resolves to. Returns newly mastered texts. */
  private async applyAnswers(
    answers: PracticeAnswer[],
    at: string,
    resolve: (answer: PracticeAnswer) => MistakeRecord | null,
  ): Promise<string[]> {
    const newlyMastered: string[] = [];
    for (const answer of answers) {
      const record = resolve(answer);
      if (!record) continue;
      const next = answer.correct ? applyCorrect(record, at) : applyWrong(record, at, answer.answer);
      if (next === record) continue;
      if (!isMastered(record) && isMastered(next)) newlyMastered.push(next.text);
      await this.mistakes.save(next);
    }
    return newlyMastered;
  }
}
