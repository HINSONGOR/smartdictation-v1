import type { ISODateString } from "./common";
import type { DictationList } from "./dictation";
import type { MistakeRecord } from "./mistake";
import type { PlannerSettings, StudentTask } from "./planner";
import type { PracticeSession } from "./practice";
import type { PromptEntry } from "./prompts";
import type { KnowledgeItem } from "./knowledge";
import type { StudentProfile } from "./student";

/** All learning data on this device (the owner PIN and device settings are not part of it). */
export interface LearningDataSnapshot {
  students: StudentProfile[];
  lists: DictationList[];
  mistakes: MistakeRecord[];
  sessions: PracticeSession[];
  /** Management-centre tasks (format 2+; older backups have none). */
  tasks: StudentTask[];
  /** Family planner options: 0 or 1 record. */
  planner: PlannerSettings[];
  /** Study notes / examples / Q&A / vocabulary per student. Missing in older files. */
  knowledge: KnowledgeItem[];
  /** AI prompt library (family-shared and per student). Missing in older files. */
  prompts: PromptEntry[];
}

/** Kept as "SmartDictation" (the app's former name) so older backup files still import. */
export const BACKUP_APP_ID = "SmartDictation";
/** 2: adds tasks + planner. Format 1 files still import (with no tasks). */
export const BACKUP_FORMAT_VERSION = 2;

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
