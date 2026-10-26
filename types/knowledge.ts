import type { Entity, ISODateString, StudentScoped } from "./common";

/** 個人溫習知識庫: a student's own study notes, worked examples, Q&A cards and vocabulary. */

export const KNOWLEDGE_KINDS = ["note", "example", "qa", "vocab"] as const;
export type KnowledgeKind = (typeof KNOWLEDGE_KINDS)[number];

export interface KnowledgeItem extends Entity, StudentScoped {
  kind: KnowledgeKind;
  subjectId?: string;
  /** Lesson / unit, e.g. "第3課", "Unit 2" — groups items and helps searching. */
  topic?: string;
  /** note: heading · example: short name · qa: the question · vocab: the word. */
  title: string;
  /** note: the notes · example: the question · qa: (optional) more detail · vocab: the meaning. */
  body: string;
  /** example: worked solution · qa: the answer. Hidden until "顯示答案". */
  answer?: string;
  /** vocab: example sentences. */
  examples?: string[];
  /** Shown first. */
  pinned?: boolean;
  /** Self-test results (問答 / 生字 review mode). */
  known?: number;
  unknown?: number;
  lastReviewedAt?: ISODateString;
  schoolYear: string;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface KnowledgeInput {
  kind: KnowledgeKind;
  subjectId?: string;
  topic?: string;
  title: string;
  body: string;
  answer?: string;
  examples?: string[];
  pinned?: boolean;
}

export const KNOWLEDGE_LIMITS = {
  titleMaxLength: 120,
  topicMaxLength: 30,
  bodyMaxLength: 5000,
  answerMaxLength: 5000,
  maxExamples: 10,
  exampleMaxLength: 200,
} as const;
