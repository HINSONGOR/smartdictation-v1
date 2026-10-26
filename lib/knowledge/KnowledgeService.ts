import type { KnowledgeRepository } from "@/lib/data";
import { ServiceError } from "@/lib/errors";
import { dateKey, schoolYearOf } from "@/lib/planner/plannerRules";
import { createId, nowIso } from "@/lib/utils/id";
import { DICTATION_LIMITS, KNOWLEDGE_KINDS, KNOWLEDGE_LIMITS, type DictationLanguage, type KnowledgeInput, type KnowledgeItem } from "@/types";

/** 個人溫習知識庫: a student's notes, worked examples, Q&A cards and vocabulary. */
export class KnowledgeService {
  constructor(private readonly items: KnowledgeRepository) {}

  /** Pinned first, then most recently changed. */
  async list(studentId: string): Promise<KnowledgeItem[]> {
    return (await this.items.listByStudent(studentId)).sort(
      (a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updatedAt.localeCompare(a.updatedAt),
    );
  }

  async get(studentId: string, id: string): Promise<KnowledgeItem | null> {
    return this.items.getForStudent(studentId, id);
  }

  async create(studentId: string, input: KnowledgeInput): Promise<KnowledgeItem> {
    const now = nowIso();
    const item: KnowledgeItem = {
      id: createId(),
      studentId,
      ...this.validate(input),
      schoolYear: schoolYearOf(dateKey(new Date())),
      createdAt: now,
      updatedAt: now,
    };
    await this.items.save(item);
    return item;
  }

  async update(studentId: string, id: string, input: KnowledgeInput): Promise<KnowledgeItem> {
    const item = await this.require(studentId, id);
    const { subjectId: _s, topic: _t, answer: _a, examples: _e, pinned: _p, ...kept } = item;
    void [_s, _t, _a, _e, _p];
    const updated: KnowledgeItem = { ...kept, ...this.validate(input), updatedAt: nowIso() };
    await this.items.save(updated);
    return updated;
  }

  async setPinned(studentId: string, id: string, pinned: boolean): Promise<KnowledgeItem> {
    const item = await this.require(studentId, id);
    const updated: KnowledgeItem = { ...item, updatedAt: nowIso() };
    if (pinned) updated.pinned = true;
    else delete updated.pinned;
    await this.items.save(updated);
    return updated;
  }

  /** Review mode: the student knew it (識) or not (唔識). */
  async recordReview(studentId: string, id: string, knew: boolean): Promise<KnowledgeItem> {
    const item = await this.require(studentId, id);
    const now = nowIso();
    const updated: KnowledgeItem = knew
      ? { ...item, known: (item.known ?? 0) + 1, lastReviewedAt: now }
      : { ...item, unknown: (item.unknown ?? 0) + 1, lastReviewedAt: now };
    await this.items.save(updated);
    return updated;
  }

  async remove(studentId: string, id: string): Promise<void> {
    await this.items.removeForStudent(studentId, id);
  }

  private async require(studentId: string, id: string): Promise<KnowledgeItem> {
    const item = await this.items.getForStudent(studentId, id);
    if (!item) throw new ServiceError("knowledge.notFound");
    return item;
  }

  private validate(input: KnowledgeInput): Omit<KnowledgeItem, "id" | "studentId" | "schoolYear" | "createdAt" | "updatedAt"> {
    const kind = KNOWLEDGE_KINDS.includes(input.kind) ? input.kind : "note";
    const title = input.title.trim();
    const body = input.body.trim();
    const answer = input.answer?.trim() ?? "";
    const topic = input.topic?.trim() ?? "";
    if (!title) throw new ServiceError("knowledge.titleRequired");
    if (title.length > KNOWLEDGE_LIMITS.titleMaxLength || topic.length > KNOWLEDGE_LIMITS.topicMaxLength) {
      throw new ServiceError("knowledge.tooLong");
    }
    if (body.length > KNOWLEDGE_LIMITS.bodyMaxLength || answer.length > KNOWLEDGE_LIMITS.answerMaxLength) {
      throw new ServiceError("knowledge.tooLong");
    }
    if ((kind === "note" || kind === "example") && !body) throw new ServiceError("knowledge.bodyRequired");
    if ((kind === "example" || kind === "qa") && !answer) throw new ServiceError("knowledge.answerRequired");
    const examples =
      kind === "vocab"
        ? (input.examples ?? [])
            .map((e) => e.trim().slice(0, KNOWLEDGE_LIMITS.exampleMaxLength))
            .filter(Boolean)
            .slice(0, KNOWLEDGE_LIMITS.maxExamples)
        : [];
    return {
      kind,
      title,
      body,
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
      ...(topic ? { topic } : {}),
      ...(answer && kind !== "note" && kind !== "vocab" ? { answer } : {}),
      ...(examples.length ? { examples } : {}),
      ...(input.pinned ? { pinned: true } : {}),
    };
  }
}

/** Dictation language for vocabulary: from the subject, else from the words themselves. */
export function vocabLanguage(items: KnowledgeItem[]): DictationLanguage {
  if (items.some((i) => i.subjectId === "english")) return "en";
  if (items.some((i) => i.subjectId === "chinese")) return "zh";
  return items.some((i) => /\p{Script=Han}/u.test(i.title)) ? "zh" : "en";
}

/** Word list text for a new dictation list: one "word | meaning" per line. */
export function vocabItemsText(items: KnowledgeItem[]): string {
  return items
    .filter((i) => i.kind === "vocab")
    .map((i) => {
      const hint = i.body.split("\n")[0].replace(/\|/g, "/").trim().slice(0, DICTATION_LIMITS.itemMaxLength);
      return hint ? `${i.title} | ${hint}` : i.title;
    })
    .join("\n");
}
