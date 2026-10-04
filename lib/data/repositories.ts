/**
 * Repository contracts.
 *
 * ARCHITECTURE RULE: these interfaces are the ONLY thing services know about data.
 * They must stay independent of any data source:
 *   - every method is async (Promise) so a network DB can implement them,
 *   - no storage-specific types (localStorage keys, Firestore refs, SQL rows) leak out,
 *   - inputs/outputs are plain domain types from `@/types`.
 *
 * V1 implementation: `./local` (Local Data / Local JSON).
 * V2 can add `./firestore`, `./supabase`, ... and switch in `./index.ts`
 * without touching UI or services.
 */
import type {
  AppSettings,
  DictationLanguage,
  DictationList,
  LearningDataSnapshot,
  MistakeRecord,
  OwnerProfile,
  PracticeSession,
  StudentProfile,
} from "@/types";

export interface StudentRepository {
  /** All profiles, including inactive ones. Owner-level access. */
  listAll(): Promise<StudentProfile[]>;
  getById(id: string): Promise<StudentProfile | null>;
  count(): Promise<number>;
  save(student: StudentProfile): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface OwnerRepository {
  get(): Promise<OwnerProfile>;
  save(owner: OwnerProfile): Promise<void>;
}

/** Any store of learning data that belongs to a student (used when a student is deleted). */
export interface StudentScopedStore {
  countForStudent(studentId: string): Promise<number>;
  removeAllForStudent(studentId: string): Promise<void>;
}

/** Dictation content. Every query is scoped by studentId. */
export interface ContentRepository extends StudentScopedStore {
  listByStudent(studentId: string, language?: DictationLanguage): Promise<DictationList[]>;
  getForStudent(studentId: string, listId: string): Promise<DictationList | null>;
  save(list: DictationList): Promise<void>;
  removeForStudent(studentId: string, listId: string): Promise<void>;
}

/** Mistake records. Every query is scoped by studentId. */
export interface MistakeRepository extends StudentScopedStore {
  listByStudent(studentId: string, language?: DictationLanguage): Promise<MistakeRecord[]>;
  save(record: MistakeRecord): Promise<void>;
  removeForStudent(studentId: string, recordId: string): Promise<void>;
}

/** Finished practice sessions. Every query is scoped by studentId. */
export interface PracticeRepository extends StudentScopedStore {
  listByStudent(studentId: string, language?: DictationLanguage): Promise<PracticeSession[]>;
  save(session: PracticeSession): Promise<void>;
}

/**
 * Whole-device learning data, for backup export / import (owner-level).
 * replaceAll must swap every collection; a cloud implementation would do it in one transaction.
 */
export interface BackupStore {
  readAll(): Promise<LearningDataSnapshot>;
  replaceAll(snapshot: LearningDataSnapshot): Promise<void>;
}

/** Per-device settings (locale, theme, selected student). */
export interface SettingsRepository {
  get(): Promise<AppSettings>;
  save(settings: AppSettings): Promise<void>;
}

export interface Repositories {
  students: StudentRepository;
  owner: OwnerRepository;
  content: ContentRepository;
  mistakes: MistakeRepository;
  practice: PracticeRepository;
  settings: SettingsRepository;
  backup: BackupStore;
}
