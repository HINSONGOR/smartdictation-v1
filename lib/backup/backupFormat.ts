import { ServiceError } from "@/lib/errors";
import {
  BACKUP_APP_ID,
  BACKUP_FORMAT_VERSION,
  MAX_STUDENTS,
  type BackupCounts,
  type BackupFile,
  type LearningDataSnapshot,
} from "@/types";

export function countsOf(snapshot: LearningDataSnapshot): BackupCounts {
  return {
    students: snapshot.students.length,
    lists: snapshot.lists.length,
    mistakes: snapshot.mistakes.length,
    sessions: snapshot.sessions.length,
  };
}

export function buildBackupFile(snapshot: LearningDataSnapshot, now: Date): BackupFile {
  return { app: BACKUP_APP_ID, formatVersion: BACKUP_FORMAT_VERSION, exportedAt: now.toISOString(), data: snapshot };
}

/** smartdictation-backup-20261004-1530.json (local time). */
export function backupFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `smartdictation-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

// ---- validation ---------------------------------------------------------

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNonEmpty = (v: unknown): v is string => isStr(v) && v.trim().length > 0;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
const isLang = (v: unknown) => v === "zh" || v === "en";
const isTextItem = (v: unknown) => isRec(v) && isNonEmpty(v.id) && isStr(v.text);

const VALID = {
  students: (r: Rec) =>
    isNonEmpty(r.id) && isNonEmpty(r.name) && isStr(r.pin) && /^\d{4}$/.test(r.pin) && isStr(r.createdAt) && typeof r.active === "boolean",
  lists: (r: Rec) =>
    isNonEmpty(r.id) &&
    isNonEmpty(r.studentId) &&
    isLang(r.language) &&
    isStr(r.title) &&
    Array.isArray(r.items) &&
    r.items.every(isTextItem) &&
    (r.type === undefined || r.type === "words" || r.type === "mixed") &&
    (r.paragraphs === undefined || (Array.isArray(r.paragraphs) && r.paragraphs.every(isTextItem))) &&
    isStr(r.createdAt) &&
    isStr(r.updatedAt),
  mistakes: (r: Rec) =>
    isNonEmpty(r.id) &&
    isNonEmpty(r.studentId) &&
    isLang(r.language) &&
    isStr(r.listId) &&
    isStr(r.itemId) &&
    isStr(r.text) &&
    isNum(r.count) &&
    isStr(r.lastMistakeAt),
  sessions: (r: Rec) =>
    isNonEmpty(r.id) &&
    isNonEmpty(r.studentId) &&
    (r.listId === null || isStr(r.listId)) &&
    isLang(r.language) &&
    (r.mode === "typing" || r.mode === "paper") &&
    isNum(r.total) &&
    isNum(r.correct) &&
    Array.isArray(r.answers) &&
    isStr(r.startedAt) &&
    isStr(r.finishedAt),
} satisfies Record<keyof LearningDataSnapshot, (r: Rec) => boolean>;

/** Keep the first record per id. */
function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
}

export interface ParsedBackup {
  file: BackupFile;
  counts: BackupCounts;
  /** Learning records skipped because their student isn't in the backup. */
  orphansDropped: number;
}

/**
 * Parse and validate a backup file. Malformed files are rejected as a whole
 * (never half-imported); records of students missing from the backup are dropped and counted.
 */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ServiceError("backup.invalidFile");
  }
  if (!isRec(raw) || raw.app !== BACKUP_APP_ID) throw new ServiceError("backup.wrongApp");
  if (!isNum(raw.formatVersion) || !isStr(raw.exportedAt) || !isRec(raw.data)) throw new ServiceError("backup.invalidFile");
  if (raw.formatVersion > BACKUP_FORMAT_VERSION) throw new ServiceError("backup.newerVersion");

  const data = raw.data;
  for (const key of Object.keys(VALID) as (keyof typeof VALID)[]) {
    const list = data[key];
    if (!Array.isArray(list) || !list.every((r) => isRec(r) && VALID[key](r))) throw new ServiceError("backup.invalidFile");
  }

  const students = uniqueById(data.students as LearningDataSnapshot["students"]);
  if (students.length > MAX_STUDENTS) throw new ServiceError("backup.tooManyStudents");
  const ids = new Set(students.map((s) => s.id));
  let orphansDropped = 0;
  const owned = <T extends { id: string; studentId: string }>(items: T[]) => {
    const kept = uniqueById(items).filter((r) => ids.has(r.studentId));
    orphansDropped += items.length - kept.length;
    return kept;
  };

  const snapshot: LearningDataSnapshot = {
    students,
    lists: owned(data.lists as LearningDataSnapshot["lists"]),
    mistakes: owned(data.mistakes as LearningDataSnapshot["mistakes"]),
    sessions: owned(data.sessions as LearningDataSnapshot["sessions"]),
  };
  return {
    file: { app: BACKUP_APP_ID, formatVersion: raw.formatVersion, exportedAt: raw.exportedAt, data: snapshot },
    counts: countsOf(snapshot),
    orphansDropped,
  };
}
