import { ServiceError } from "@/lib/errors";
import { MAX_STUDENTS, STUDENT_NAME_MAX_LENGTH, type BackupCounts, type LearningDataSnapshot, type StudentProfile } from "@/types";

export interface MergeResult {
  snapshot: LearningDataSnapshot;
  added: BackupCounts;
  /** Students added under a new name because the name was taken: [original, new]. */
  renamed: [string, string][];
}

const norm = (name: string) => name.trim().toLowerCase();

/** "小明" → "小明（2）", "小明（3）" … — the first free name, kept within the length limit. */
function freeName(name: string, taken: Set<string>): string {
  for (let n = 2; ; n++) {
    const suffix = `（${n}）`;
    const candidate = name.slice(0, STUDENT_NAME_MAX_LENGTH - suffix.length) + suffix;
    if (!taken.has(norm(candidate))) return candidate;
  }
}

/**
 * Merge a backup into the current data: everything already on this device stays as it is;
 * records from the backup are added when their id is new. A new student whose name is taken
 * gets a numbered name. Learning records are only added for students that exist after merging.
 */
export function mergeSnapshots(current: LearningDataSnapshot, incoming: LearningDataSnapshot): MergeResult {
  const studentIds = new Set(current.students.map((s) => s.id));
  const names = new Set(current.students.map((s) => norm(s.name)));
  const students: StudentProfile[] = [...current.students];
  const renamed: [string, string][] = [];

  for (const student of incoming.students) {
    if (studentIds.has(student.id)) continue;
    let name = student.name;
    if (names.has(norm(name))) {
      name = freeName(student.name, names);
      renamed.push([student.name, name]);
    }
    students.push({ ...student, name });
    studentIds.add(student.id);
    names.add(norm(name));
  }
  if (students.length > MAX_STUDENTS) throw new ServiceError("backup.tooManyStudents");

  const addNew = <T extends { id: string; studentId: string }>(mine: T[], theirs: T[]) => {
    const ids = new Set(mine.map((r) => r.id));
    const extra = theirs.filter((r) => !ids.has(r.id) && studentIds.has(r.studentId));
    return { merged: [...mine, ...extra], added: extra.length };
  };
  const lists = addNew(current.lists, incoming.lists);
  const mistakes = addNew(current.mistakes, incoming.mistakes);
  const sessions = addNew(current.sessions, incoming.sessions);

  return {
    snapshot: { students, lists: lists.merged, mistakes: mistakes.merged, sessions: sessions.merged },
    added: {
      students: students.length - current.students.length,
      lists: lists.added,
      mistakes: mistakes.added,
      sessions: sessions.added,
    },
    renamed,
  };
}
