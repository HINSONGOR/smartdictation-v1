import type {
  AppSettings,
  DictationLanguage,
  DictationList,
  Entity,
  LearningDataSnapshot,
  MistakeRecord,
  OwnerProfile,
  PracticeSession,
  StudentProfile,
  StudentScoped,
} from "@/types";
import { DEFAULT_SETTINGS } from "@/types";
import type {
  BackupStore,
  ContentRepository,
  MistakeRepository,
  OwnerRepository,
  PracticeRepository,
  Repositories,
  SettingsRepository,
  StudentRepository,
  StudentScopedStore,
} from "../repositories";
import type { KeyValueStore } from "./keyValueStore";
import { LocalCollection } from "./localCollection";
import seedOwner from "../seed/owner.json";
import seedStudents from "../seed/students.json";
import seedDictationLists from "../seed/dictation-lists.json";
import seedMistakes from "../seed/mistakes.json";
import seedPracticeSessions from "../seed/practice-sessions.json";

const KEYS = {
  students: "students",
  owner: "owner",
  content: "dictation-lists",
  mistakes: "mistakes",
  practice: "practice-sessions",
  settings: "settings",
} as const;

class LocalStudentRepository implements StudentRepository {
  private readonly collection: LocalCollection<StudentProfile>;

  constructor(store: KeyValueStore) {
    this.collection = new LocalCollection(store, KEYS.students, seedStudents as StudentProfile[]);
  }

  async listAll() {
    return this.collection.all();
  }

  async getById(id: string) {
    return this.collection.find((s) => s.id === id);
  }

  async count() {
    return this.collection.all().length;
  }

  async save(student: StudentProfile) {
    this.collection.upsert(student);
  }

  async remove(id: string) {
    this.collection.removeWhere((s) => s.id === id);
  }
}

/** Shared behaviour for collections of learning data that carry a studentId. */
abstract class LocalStudentScopedRepository<T extends Entity & StudentScoped> implements StudentScopedStore {
  protected readonly collection: LocalCollection<T>;

  constructor(store: KeyValueStore, key: string, seed: T[]) {
    this.collection = new LocalCollection(store, key, seed);
  }

  async countForStudent(studentId: string) {
    return this.collection.filter((r) => r.studentId === studentId).length;
  }

  async removeAllForStudent(studentId: string) {
    this.collection.removeWhere((r) => r.studentId === studentId);
  }
}

class LocalOwnerRepository implements OwnerRepository {
  constructor(private readonly store: KeyValueStore) {}

  async get() {
    return this.store.read<OwnerProfile>(KEYS.owner) ?? { ...(seedOwner as OwnerProfile) };
  }

  async save(owner: OwnerProfile) {
    this.store.write(KEYS.owner, owner);
  }
}

class LocalContentRepository extends LocalStudentScopedRepository<DictationList> implements ContentRepository {
  constructor(store: KeyValueStore) {
    super(store, KEYS.content, seedDictationLists as DictationList[]);
  }

  async listByStudent(studentId: string, language?: DictationLanguage) {
    return this.collection.filter(
      (l) => l.studentId === studentId && (language === undefined || l.language === language),
    );
  }

  async getForStudent(studentId: string, listId: string) {
    return this.collection.find((l) => l.studentId === studentId && l.id === listId);
  }

  async save(list: DictationList) {
    this.collection.upsert(list);
  }

  async removeForStudent(studentId: string, listId: string) {
    this.collection.removeWhere((l) => l.studentId === studentId && l.id === listId);
  }
}

class LocalMistakeRepository extends LocalStudentScopedRepository<MistakeRecord> implements MistakeRepository {
  constructor(store: KeyValueStore) {
    super(store, KEYS.mistakes, seedMistakes as MistakeRecord[]);
  }

  async listByStudent(studentId: string, language?: DictationLanguage) {
    return this.collection.filter(
      (m) => m.studentId === studentId && (language === undefined || m.language === language),
    );
  }

  async save(record: MistakeRecord) {
    this.collection.upsert(record);
  }

  async removeForStudent(studentId: string, recordId: string) {
    this.collection.removeWhere((m) => m.studentId === studentId && m.id === recordId);
  }
}

class LocalPracticeRepository extends LocalStudentScopedRepository<PracticeSession> implements PracticeRepository {
  constructor(store: KeyValueStore) {
    super(store, KEYS.practice, seedPracticeSessions as PracticeSession[]);
  }

  async listByStudent(studentId: string, language?: DictationLanguage) {
    return this.collection.filter(
      (s) => s.studentId === studentId && (language === undefined || s.language === language),
    );
  }

  async save(session: PracticeSession) {
    this.collection.upsert(session);
  }
}

/** Reads / swaps every learning-data collection at once (same storage keys as the repositories above). */
class LocalBackupStore implements BackupStore {
  constructor(private readonly store: KeyValueStore) {}

  async readAll(): Promise<LearningDataSnapshot> {
    return {
      students: new LocalCollection(this.store, KEYS.students, seedStudents as StudentProfile[]).all(),
      lists: new LocalCollection(this.store, KEYS.content, seedDictationLists as DictationList[]).all(),
      mistakes: new LocalCollection(this.store, KEYS.mistakes, seedMistakes as MistakeRecord[]).all(),
      sessions: new LocalCollection(this.store, KEYS.practice, seedPracticeSessions as PracticeSession[]).all(),
    };
  }

  async replaceAll(snapshot: LearningDataSnapshot): Promise<void> {
    this.store.write(KEYS.students, snapshot.students);
    this.store.write(KEYS.content, snapshot.lists);
    this.store.write(KEYS.mistakes, snapshot.mistakes);
    this.store.write(KEYS.practice, snapshot.sessions);
  }
}

class LocalSettingsRepository implements SettingsRepository {
  constructor(private readonly store: KeyValueStore) {}

  async get() {
    return { ...DEFAULT_SETTINGS, ...this.store.read<Partial<AppSettings>>(KEYS.settings) };
  }

  async save(settings: AppSettings) {
    this.store.write(KEYS.settings, settings);
  }
}

export function createLocalRepositories(store: KeyValueStore): Repositories {
  return {
    students: new LocalStudentRepository(store),
    owner: new LocalOwnerRepository(store),
    content: new LocalContentRepository(store),
    mistakes: new LocalMistakeRepository(store),
    practice: new LocalPracticeRepository(store),
    backup: new LocalBackupStore(store),
    settings: new LocalSettingsRepository(store),
  };
}
