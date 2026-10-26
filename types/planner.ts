import type { Entity, ISODateString, StudentScoped } from "./common";
import type { DictationLanguage } from "./dictation";

/**
 * Student management centre (學生管理中心): tasks, deadlines, exams and revision on a calendar.
 * Categories and subjects are open lists: built-ins live in code, families add their own
 * (stored in one PlannerSettings record), so new kinds of tasks need no new screens.
 */

/** Calendar day "YYYY-MM-DD" (local date, no time zone). */
export type DateKey = string;

/** Colours a parent can give a category / subject (shown as dots and stripes). */
export const PLANNER_COLORS = ["red", "orange", "amber", "green", "teal", "blue", "purple", "pink", "gray"] as const;
export type PlannerColor = (typeof PLANNER_COLORS)[number];

export const BUILT_IN_CATEGORY_IDS = ["dictation", "exam", "homework", "notice", "revision", "other"] as const;
export type BuiltInCategoryId = (typeof BUILT_IN_CATEGORY_IDS)[number];

export const BUILT_IN_SUBJECT_IDS = ["chinese", "english", "math", "gs"] as const;
export type BuiltInSubjectId = (typeof BUILT_IN_SUBJECT_IDS)[number];

/** A family-added category (built-ins are named through i18n). */
export interface TaskCategory {
  id: string;
  name: string;
  icon: string;
  color: PlannerColor;
}

/** A family-added subject (e.g. 物理, 歷史). */
export interface Subject {
  id: string;
  name: string;
  color: PlannerColor;
}

/** Family-wide planner options (one record, id "planner"). */
export interface PlannerSettings extends Entity {
  categories: TaskCategory[];
  subjects: Subject[];
  updatedAt: ISODateString;
}

export const PLANNER_SETTINGS_ID = "planner";

/**
 * Where a task leads when opened. Open-ended: later stages add e.g. knowledge-base notes.
 * Links only point at existing screens — the dictation system itself is not changed.
 */
export type TaskLink =
  | { kind: "dictationList"; listId: string; language: DictationLanguage }
  | { kind: "mistakeReview"; language: DictationLanguage };

export interface StudentTask extends Entity, StudentScoped {
  title: string;
  categoryId: string;
  subjectId?: string;
  /** Day it is due / scheduled. */
  date: DateKey;
  /** Optional deadline time "HH:mm". */
  time?: string;
  /** Estimated minutes. */
  minutes?: number;
  notes?: string;
  link?: TaskLink;
  /** Revision task planned for this exam task (id). */
  examId?: string;
  done: boolean;
  doneAt?: ISODateString;
  /** Hong Kong school year the task belongs to, e.g. "2026-27". */
  schoolYear: string;
  /** Room for fields of future task kinds. */
  extra?: Record<string, unknown>;
  createdAt: ISODateString;
  updatedAt: ISODateString;
}

export interface TaskInput {
  title: string;
  categoryId: string;
  subjectId?: string;
  date: DateKey;
  time?: string;
  minutes?: number;
  notes?: string;
  link?: TaskLink;
  /** createMany only: a name for this new task, so others in the same batch can point at it. */
  ref?: string;
  /** createMany only: this is a revision task for the batch task with this ref. */
  examRef?: string;
}

export const TASK_LIMITS = {
  titleMaxLength: 60,
  notesMaxLength: 500,
  maxMinutes: 600,
  categoryNameMaxLength: 12,
  maxCustomCategories: 20,
  maxCustomSubjects: 20,
} as const;

/** Exams / dictations show a countdown on the home screen this many days ahead. */
export const COUNTDOWN_DAYS = 7;

export const SCHOOL_GRADES = ["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6"] as const;
export type SchoolGrade = (typeof SCHOOL_GRADES)[number];
