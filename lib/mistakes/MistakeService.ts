import type { MistakeRepository } from "@/lib/data";
import type { DictationLanguage, MistakeRecord, PracticeItem } from "@/types";
import { isMastered } from "./mistakeRules";

export interface MistakeOverview {
  /** Still to review, most frequent first. */
  active: MistakeRecord[];
  /** Mastered, most recent first. */
  mastered: MistakeRecord[];
}

/** Mistake review logic. Recording / mastering happens in PracticeService via mistakeRules. */
export class MistakeService {
  constructor(private readonly mistakes: MistakeRepository) {}

  async overview(studentId: string, language?: DictationLanguage): Promise<MistakeOverview> {
    const records = await this.mistakes.listByStudent(studentId, language);
    return {
      active: records
        .filter((r) => !isMastered(r))
        .sort((a, b) => b.count - a.count || b.lastMistakeAt.localeCompare(a.lastMistakeAt)),
      mastered: records
        .filter(isMastered)
        .sort((a, b) => (b.masteredAt ?? "").localeCompare(a.masteredAt ?? "")),
    };
  }

  async activeCount(studentId: string): Promise<number> {
    return (await this.overview(studentId)).active.length;
  }

  /** Review queue for one language: words first, then sentences. Item id = mistake record id. */
  async reviewItems(studentId: string, language: DictationLanguage): Promise<PracticeItem[]> {
    const { active } = await this.overview(studentId, language);
    const items: PracticeItem[] = active.map((r) => {
      const item: PracticeItem = { id: r.id, text: r.text, kind: r.kind ?? "word" };
      if (r.hint) item.hint = r.hint;
      return item;
    });
    return [...items.filter((i) => i.kind === "word"), ...items.filter((i) => i.kind === "sentence")];
  }

  /** Delete one mistake record (e.g. the child already knows it). Only the student's own record. */
  async remove(studentId: string, recordId: string): Promise<void> {
    await this.mistakes.removeForStudent(studentId, recordId);
  }

  /** Remove mastered records (owner / student tidy-up). */
  async clearMastered(studentId: string): Promise<void> {
    const { mastered } = await this.overview(studentId);
    for (const record of mastered) await this.mistakes.removeForStudent(studentId, record.id);
  }
}
