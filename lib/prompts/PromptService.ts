import type { PromptRepository } from "@/lib/data";
import { ServiceError } from "@/lib/errors";
import { createId, nowIso } from "@/lib/utils/id";
import { PROMPT_AIS, PROMPT_LIMITS, PROMPT_PURPOSES, type PromptEntry, type PromptInput, type PromptVersion } from "@/types";

/**
 * AI 指令收納庫. A student sees the family's shared prompts plus their own ("我的").
 * Editing keeps the previous version, so changes can be compared or undone.
 */
export class PromptService {
  constructor(private readonly prompts: PromptRepository) {}

  /** Newest first. */
  async list(studentId: string): Promise<PromptEntry[]> {
    return (await this.prompts.listVisible(studentId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(studentId: string, id: string): Promise<PromptEntry | null> {
    const prompt = await this.prompts.get(id);
    return prompt && this.visible(prompt, studentId) ? prompt : null;
  }

  async create(studentId: string, input: PromptInput): Promise<PromptEntry> {
    const clean = this.validate(input);
    const now = nowIso();
    const prompt: PromptEntry = {
      id: createId(),
      ownerStudentId: input.shared ? null : studentId,
      ...clean,
      versions: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.prompts.save(prompt);
    return prompt;
  }

  /** Save changes; a changed title or text keeps the old one as a version. */
  async update(studentId: string, id: string, input: PromptInput): Promise<PromptEntry> {
    const prompt = await this.require(studentId, id);
    const clean = this.validate(input);
    const changed = clean.title !== prompt.title || clean.content !== prompt.content;
    const { subjectId: _s, ...rest } = prompt;
    void _s;
    const updated: PromptEntry = {
      ...rest,
      ...clean,
      ownerStudentId: input.shared ? null : (prompt.ownerStudentId ?? studentId),
      versions: changed ? this.withVersion(prompt, input.changeNote) : prompt.versions,
      updatedAt: nowIso(),
    };
    await this.prompts.save(updated);
    return updated;
  }

  /** Bring back an older version (the current one is kept as a version too). */
  async restore(studentId: string, id: string, versionIndex: number): Promise<PromptEntry> {
    const prompt = await this.require(studentId, id);
    const version = prompt.versions[versionIndex];
    if (!version) throw new ServiceError("prompt.notFound");
    const updated: PromptEntry = {
      ...prompt,
      title: version.title,
      content: version.content,
      versions: this.withVersion(prompt),
      updatedAt: nowIso(),
    };
    await this.prompts.save(updated);
    return updated;
  }

  async remove(studentId: string, id: string): Promise<void> {
    await this.require(studentId, id);
    await this.prompts.remove(id);
  }

  /** Version number shown as "v3". */
  static versionOf(prompt: PromptEntry): number {
    return prompt.versions.length + 1;
  }

  private withVersion(prompt: PromptEntry, note?: string): PromptVersion[] {
    const version: PromptVersion = { title: prompt.title, content: prompt.content, savedAt: prompt.updatedAt };
    const trimmed = note?.trim().slice(0, PROMPT_LIMITS.noteMaxLength);
    if (trimmed) version.note = trimmed;
    return [...prompt.versions, version].slice(-PROMPT_LIMITS.maxVersions);
  }

  private visible(prompt: PromptEntry, studentId: string) {
    return prompt.ownerStudentId === null || prompt.ownerStudentId === studentId;
  }

  private async require(studentId: string, id: string): Promise<PromptEntry> {
    const prompt = await this.get(studentId, id);
    if (!prompt) throw new ServiceError("prompt.notFound");
    return prompt;
  }

  private validate(input: PromptInput): Pick<PromptEntry, "title" | "content" | "subjectId" | "purpose" | "ai"> {
    const title = input.title.trim();
    const content = input.content.trim();
    if (!title) throw new ServiceError("prompt.titleRequired");
    if (title.length > PROMPT_LIMITS.titleMaxLength) throw new ServiceError("prompt.titleTooLong");
    if (!content) throw new ServiceError("prompt.contentRequired");
    if (content.length > PROMPT_LIMITS.contentMaxLength) throw new ServiceError("prompt.contentTooLong");
    return {
      title,
      content,
      ...(input.subjectId ? { subjectId: input.subjectId } : {}),
      purpose: PROMPT_PURPOSES.includes(input.purpose) ? input.purpose : "other",
      ai: PROMPT_AIS.includes(input.ai) ? input.ai : "any",
    };
  }
}
