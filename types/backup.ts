import type { ISODateString } from "./common";
import type { DictationList } from "./dictation";
import type { MistakeRecord } from "./mistake";
import type { PracticeSession } from "./practice";
import type { StudentProfile } from "./student";

/** All learning data on this device (the owner PIN and device settings are not part of it). */
export interface LearningDataSnapshot {
  students: StudentProfile[];
  lists: DictationList[];
  mistakes: MistakeRecord[];
  sessions: PracticeSession[];
}

export const BACKUP_APP_ID = "SmartDictation";
export const BACKUP_FORMAT_VERSION = 1;

/** The JSON file written by "export" and read by "import". */
export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  exportedAt: ISODateString;
  data: LearningDataSnapshot;
}

/** merge = add what is missing (by id); replace = this device's data becomes the backup's. */
export type ImportMode = "merge" | "replace";

export type BackupCounts = Record<keyof LearningDataSnapshot, number>;
