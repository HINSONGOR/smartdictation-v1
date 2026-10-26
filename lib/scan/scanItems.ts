import { isDateKey } from "@/lib/planner/plannerRules";
import type { SubjectView } from "@/lib/planner/plannerRules";
import type { DateKey } from "@/types";

/**
 * AI document scan (影相文件整理): turn Gemini's JSON answer into editable items.
 * Everything here is checked and corrected by a parent before it becomes a task.
 */

export interface ScannedItem {
  /** React key. */
  key: string;
  include: boolean;
  title: string;
  date: DateKey;
  /** The AI gave no usable date — highlighted for checking. */
  dateMissing: boolean;
  time?: string;
  categoryId: string;
  subjectId?: string;
  /** Exam / dictation coverage, one part per entry. */
  scope: string[];
  notes?: string;
}

const KIND_TO_CATEGORY: Record<string, string> = {
  exam: "exam",
  dictation: "dictation",
  homework: "homework",
  notice: "notice",
  other: "other",
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The JSON object inside the answer (tolerates ```json fences or text around it). */
function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Map the AI's subject ("math", "數學", "Physics"…) to a known subject id. */
function matchSubject(raw: string, subjects: SubjectView[], names: (s: SubjectView) => string[]): string | undefined {
  const value = raw.toLowerCase();
  if (!value) return undefined;
  return subjects.find((s) => s.id === value || names(s).some((n) => n.toLowerCase() === value))?.id;
}

let keySeq = 0;

/**
 * Parse the scan answer. Returns null when the answer isn't readable JSON.
 * `subjectNames` gives every name a subject may appear under (e.g. both languages for built-ins).
 */
export function parseScanResult(
  text: string,
  today: DateKey,
  subjects: SubjectView[],
  subjectNames: (s: SubjectView) => string[],
): ScannedItem[] | null {
  const json = extractJson(text) as { items?: unknown } | null;
  if (!json || !Array.isArray(json.items)) return null;

  const items: ScannedItem[] = [];
  for (const entry of json.items as Raw[]) {
    if (!entry || typeof entry !== "object") continue;
    const title = str(entry.title).slice(0, 60);
    if (!title) continue;
    const rawDate = str(entry.date);
    const dateOk = isDateKey(rawDate);
    const time = str(entry.time);
    const rawSubject = str(entry.subject);
    const subjectId = matchSubject(rawSubject, subjects, subjectNames);
    const notes = [str(entry.notes), !subjectId && rawSubject ? rawSubject : ""].filter(Boolean).join(" · ");
    const scope = Array.isArray(entry.scope) ? entry.scope.map(str).filter(Boolean).slice(0, 20) : [];

    items.push({
      key: `scan-${keySeq++}`,
      include: true,
      title,
      date: dateOk ? rawDate : today,
      dateMissing: !dateOk,
      ...(/^\d{2}:\d{2}$/.test(time) ? { time } : {}),
      categoryId: KIND_TO_CATEGORY[str(entry.kind)] ?? "other",
      ...(subjectId ? { subjectId } : {}),
      scope,
      ...(notes ? { notes: notes.slice(0, 400) } : {}),
    });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}

const SCOPE_LINE = /^\s*(?:範圍|Scope)\s*[:：]\s*(.+)$/i;

/**
 * Exams scanned before the scope field existed kept "範圍：第3課、第4課" as a line of their notes.
 * Split it back out: { scope: ["第3課", "第4課"], notes: the other lines }.
 */
export function scopeFromNotes(notes: string | undefined): { scope: string[]; notes: string } {
  const scope: string[] = [];
  const rest: string[] = [];
  for (const line of (notes ?? "").split("\n")) {
    const match = line.match(SCOPE_LINE);
    if (match) scope.push(...match[1].split(/[、,，;；]/).map((s) => s.trim()).filter(Boolean));
    else rest.push(line);
  }
  return { scope, notes: rest.join("\n").trim() };
}
