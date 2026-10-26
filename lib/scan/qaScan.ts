import type { SubjectView } from "@/lib/planner/plannerRules";
import { KNOWLEDGE_LIMITS } from "@/types";

/** A question / answer pair read from a revision worksheet, checked by a parent before saving. */
export interface ScannedQa {
  key: string;
  include: boolean;
  question: string;
  answer: string;
}

export interface QaScanResult {
  subjectId?: string;
  topic: string;
  items: ScannedQa[];
}

/** Subject names some schools use for a built-in subject (人文科 replaced 常識 in Hong Kong primary schools). */
const ALIASES: Record<string, string[]> = { gs: ["人文", "人文科", "常識科", "general studies", "humanities"] };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
/** "1. 問題" / "（2）問題" / "Q3: …" → "問題". */
const stripNumber = (q: string) => q.replace(/^\s*(?:[Qq]\s*)?[(（]?\d{1,3}[.)）、:：]\s*/, "").trim();

let keySeq = 0;

/** Parse the AI's answer; null when it isn't readable JSON. */
export function parseQaResult(text: string, subjects: SubjectView[], names: (s: SubjectView) => string[]): QaScanResult | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  let json: { subject?: unknown; topic?: unknown; items?: unknown };
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!Array.isArray(json.items)) return null;

  const subject = str(json.subject).toLowerCase();
  const subjectId = subject
    ? subjects.find((s) => [...names(s), ...(ALIASES[s.id] ?? [])].some((n) => n.toLowerCase() === subject || subject.includes(n.toLowerCase())))?.id
    : undefined;

  const items: ScannedQa[] = [];
  for (const entry of json.items as Record<string, unknown>[]) {
    const question = stripNumber(str(entry?.question)).slice(0, KNOWLEDGE_LIMITS.titleMaxLength);
    if (!question) continue;
    items.push({ key: `qa-${keySeq++}`, include: true, question, answer: str(entry?.answer).slice(0, KNOWLEDGE_LIMITS.answerMaxLength) });
  }
  return { ...(subjectId ? { subjectId } : {}), topic: str(json.topic).slice(0, KNOWLEDGE_LIMITS.topicMaxLength), items };
}
