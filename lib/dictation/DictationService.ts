import type { ContentRepository } from "@/lib/data";
import { ServiceError } from "@/lib/errors";
import { createId, nowIso } from "@/lib/utils/id";
import {
  DICTATION_LIMITS,
  listTypeOf,
  type DictationItem,
  type DictationLanguage,
  type DictationList,
  type DictationListInput,
  type DictationListType,
} from "@/types";

export interface ParsedItem {
  text: string;
  hint?: string;
}

/** Splits "text | hint" (ASCII or full-width bar). */
const HINT_SEPARATOR = /\s*[|｜]\s*/;

/**
 * One item per line. Optional hint after "|" or "｜".
 * Blank lines are skipped; duplicate texts keep the first occurrence.
 */
export function parseItems(itemsText: string): ParsedItem[] {
  const seen = new Set<string>();
  const items: ParsedItem[] = [];
  for (const line of itemsText.split(/\r?\n/)) {
    const [rawText, ...rest] = line.split(HINT_SEPARATOR);
    const text = rawText.trim().replace(/\s+/g, " ");
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const hint = rest.join(" ").trim();
    items.push(hint ? { text, hint } : { text });
  }
  return items;
}

/** Inverse of parseItems, for filling the editor. */
export function formatItems(items: DictationItem[]): string {
  return items.map((i) => (i.hint ? `${i.text} | ${i.hint}` : i.text)).join("\n");
}

/** Trimmed, non-empty paragraph texts. */
export function cleanParagraphs(paragraphs: string[]): string[] {
  return paragraphs.map((p) => p.trim()).filter(Boolean);
}

function validate(
  input: DictationListInput,
  type: DictationListType,
): { title: string; items: ParsedItem[]; paragraphs: string[] } {
  const title = input.title.trim();
  if (!title) throw new ServiceError("dictation.titleRequired");
  if (title.length > DICTATION_LIMITS.titleMaxLength) throw new ServiceError("dictation.titleTooLong");

  const items = parseItems(input.itemsText);
  const paragraphs = type === "mixed" ? cleanParagraphs(input.paragraphs) : [];
  if (type === "words" && items.length === 0) throw new ServiceError("dictation.itemsRequired");
  if (type === "mixed" && paragraphs.length === 0) throw new ServiceError("dictation.paragraphsRequired");
  if (paragraphs.length > DICTATION_LIMITS.maxParagraphs) throw new ServiceError("dictation.tooManyParagraphs");
  if (paragraphs.some((p) => p.length > DICTATION_LIMITS.paragraphMaxLength)) {
    throw new ServiceError("dictation.paragraphTooLong");
  }
  if (items.length > DICTATION_LIMITS.maxItems) throw new ServiceError("dictation.tooManyItems");
  if (
    items.some(
      (i) =>
        i.text.length > DICTATION_LIMITS.itemMaxLength ||
        (i.hint?.length ?? 0) > DICTATION_LIMITS.hintMaxLength,
    )
  ) {
    throw new ServiceError("dictation.itemTooLong");
  }
  return { title, items, paragraphs };
}

/** Keep ids of unchanged entries (matched by text) so mistake records stay linked. */
function reuseIds<T extends { id: string; text: string }>(previous: T[] | undefined, texts: string[]) {
  const idByText = new Map((previous ?? []).map((p) => [p.text, p.id]));
  return texts.map((text) => ({ id: idByText.get(text) ?? createId(), text }));
}

/**
 * Dictation list management. Every operation is scoped by studentId:
 * a student can only read / change / delete their own lists.
 */
export class DictationService {
  constructor(private readonly content: ContentRepository) {}

  async listForStudent(studentId: string, language: DictationLanguage): Promise<DictationList[]> {
    const lists = await this.content.listByStudent(studentId, language);
    return lists.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getForStudent(studentId: string, listId: string): Promise<DictationList | null> {
    return this.content.getForStudent(studentId, listId);
  }

  async create(studentId: string, language: DictationLanguage, input: DictationListInput): Promise<DictationList> {
    const type = input.type;
    const { title, items, paragraphs } = validate(input, type);
    const now = nowIso();
    const list: DictationList = {
      id: createId(),
      studentId,
      type,
      language,
      title,
      items: items.map((i) => ({ id: createId(), ...i })),
      createdAt: now,
      updatedAt: now,
    };
    if (type === "mixed") list.paragraphs = reuseIds(undefined, paragraphs);
    await this.content.save(list);
    return list;
  }

  /**
   * The list type is fixed after creation: `input.type` is ignored and the original type is kept,
   * so editing can never drop the other part of the data (e.g. a passage's paragraphs).
   */
  async update(studentId: string, listId: string, input: DictationListInput): Promise<DictationList> {
    const existing = await this.content.getForStudent(studentId, listId);
    if (!existing) throw new ServiceError("dictation.notFound");
    const type = listTypeOf(existing);
    const { title, items, paragraphs } = validate(input, type);

    const idByText = new Map(existing.items.map((i) => [i.text, i.id]));
    const updated: DictationList = {
      ...existing,
      type,
      title,
      items: items.map((i) => ({ id: idByText.get(i.text) ?? createId(), ...i })),
      updatedAt: nowIso(),
    };
    if (type === "mixed") updated.paragraphs = reuseIds(existing.paragraphs, paragraphs);
    await this.content.save(updated);
    return updated;
  }

  async remove(studentId: string, listId: string): Promise<void> {
    const existing = await this.content.getForStudent(studentId, listId);
    if (!existing) throw new ServiceError("dictation.notFound");
    await this.content.removeForStudent(studentId, listId);
  }
}
