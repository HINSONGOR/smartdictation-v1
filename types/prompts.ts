import type { Entity, ISODateString } from "./common";

/** AI 指令收納庫: saved prompts for Gemini / ChatGPT / Claude, shared by the family or a student's own. */

export const PROMPT_PURPOSES = ["study", "writing", "explain", "quiz", "translate", "other"] as const;
export type PromptPurpose = (typeof PROMPT_PURPOSES)[number];

export const PROMPT_AIS = ["any", "gemini", "chatgpt", "claude"] as const;
export type PromptAi = (typeof PROMPT_AIS)[number];

/** An earlier version of a prompt (kept when it is edited). */
export interface PromptVersion {
  title: string;
  content: string;
  savedAt: ISODateString;
  /** What was changed in the version that replaced it (optional). */
  note?: string;
}

export interface PromptEntry extends Entity {
  /** null = shared by the whole family; otherwise only this student sees it ("我的"). */
  ownerStudentId: string | null;
  title: string;
  content: string;
  subjectId?: string;
  purpose: PromptPurpose;
  ai: PromptAi;
  /** Older versions, oldest first. Current version number = versions.length + 1. */
  versions: PromptVersion[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface PromptInput {
  title: string;
  content: string;
  subjectId?: string;
  purpose: PromptPurpose;
  ai: PromptAi;
  /** true = whole family; false = only the current student. */
  shared: boolean;
  /** Optional note on what changed (stored with the previous version). */
  changeNote?: string;
}

export const PROMPT_LIMITS = {
  titleMaxLength: 60,
  contentMaxLength: 4000,
  noteMaxLength: 100,
  maxVersions: 20,
} as const;
