import type { OwnerRepository, SettingsRepository, StudentRepository, StudentScopedStore } from "@/lib/data";
import { ServiceError } from "@/lib/errors";
import { createId, nowIso } from "@/lib/utils/id";
import {
  DEFAULT_OWNER_PIN,
  MAX_STUDENTS,
  STUDENT_NAME_MAX_LENGTH,
  type NewStudentInput,
  type StudentProfile,
  type StudentUpdateInput,
} from "@/types";

/** Public view of a profile — the PIN never leaves the service. */
export type StudentSummary = Omit<StudentProfile, "pin">;

/** The learning data stores that belong to a student, for counting / deleting. */
export interface StudentDataStores {
  lists: StudentScopedStore;
  mistakes: StudentScopedStore;
  sessions: StudentScopedStore;
}

export type StudentDataSummary = Record<keyof StudentDataStores, number>;

const PIN_PATTERN = /^\d{4}$/;

function toSummary(student: StudentProfile): StudentSummary {
  const { id, name, createdAt, active } = student;
  return { id, name, createdAt, active };
}

function sameName(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Local profile switching for a family device, plus owner (parent) management.
 * PIN checks here are a convenience to stop kids opening each other's profile —
 * they are NOT secure authentication.
 */
export class StudentService {
  constructor(
    private readonly students: StudentRepository,
    private readonly owner: OwnerRepository,
    private readonly settings: SettingsRepository,
    private readonly studentData: StudentDataStores,
  ) {}

  /** Profiles a student can pick from on the switch screen. */
  async listSelectable(): Promise<StudentSummary[]> {
    const all = await this.students.listAll();
    return all.filter((s) => s.active).map(toSummary);
  }

  async getCurrent(): Promise<StudentSummary | null> {
    const { currentStudentId } = await this.settings.get();
    if (!currentStudentId) return null;
    const student = await this.students.getById(currentStudentId);
    return student && student.active ? toSummary(student) : null;
  }

  async switchTo(studentId: string, pin: string): Promise<StudentSummary> {
    const student = await this.students.getById(studentId);
    if (!student) throw new ServiceError("student.notFound");
    if (!student.active) throw new ServiceError("student.inactive");
    if (student.pin !== pin) throw new ServiceError("student.wrongPin");
    await this.settings.save({ ...(await this.settings.get()), currentStudentId: student.id });
    return toSummary(student);
  }

  async signOutCurrent(): Promise<void> {
    await this.settings.save({ ...(await this.settings.get()), currentStudentId: null });
  }

  // ---- Owner-level operations -------------------------------------------

  async verifyOwnerPin(pin: string): Promise<void> {
    const owner = await this.owner.get();
    if (owner.pin !== pin) throw new ServiceError("owner.wrongPin");
  }

  /** True while the owner PIN is still the factory default (UI shows a reminder). */
  async isOwnerPinDefault(): Promise<boolean> {
    return (await this.owner.get()).pin === DEFAULT_OWNER_PIN;
  }

  async changeOwnerPin(currentPin: string, newPin: string): Promise<void> {
    const owner = await this.owner.get();
    if (owner.pin !== currentPin) throw new ServiceError("owner.wrongPin");
    if (!PIN_PATTERN.test(newPin)) throw new ServiceError("owner.pinInvalid");
    await this.owner.save({ ...owner, pin: newPin });
  }

  /** Owner Settings: every profile, including inactive ones. */
  async listAllForOwner(): Promise<StudentSummary[]> {
    return (await this.students.listAll()).map(toSummary);
  }

  async create(input: NewStudentInput): Promise<StudentSummary> {
    const all = await this.students.listAll();
    const name = this.validName(input.name, all);
    if (!PIN_PATTERN.test(input.pin)) throw new ServiceError("student.pinInvalid");
    if (all.length >= MAX_STUDENTS) throw new ServiceError("student.limitReached");

    const student: StudentProfile = {
      id: createId(),
      name,
      pin: input.pin,
      createdAt: nowIso(),
      active: true,
    };
    await this.students.save(student);
    return toSummary(student);
  }

  /** Rename and / or change the PIN. An empty / missing pin keeps the current one. */
  async update(studentId: string, input: StudentUpdateInput): Promise<StudentSummary> {
    const all = await this.students.listAll();
    const student = all.find((s) => s.id === studentId);
    if (!student) throw new ServiceError("student.notFound");
    const others = all.filter((s) => s.id !== studentId);
    const name = this.validName(input.name, others);
    const pin = input.pin?.trim() ? input.pin.trim() : student.pin;
    if (!PIN_PATTERN.test(pin)) throw new ServiceError("student.pinInvalid");

    const updated: StudentProfile = { ...student, name, pin };
    await this.students.save(updated);
    return toSummary(updated);
  }

  async setActive(studentId: string, active: boolean): Promise<void> {
    const student = await this.students.getById(studentId);
    if (!student) throw new ServiceError("student.notFound");
    await this.students.save({ ...student, active });
    if (!active) await this.clearCurrentIf(studentId);
  }

  /** How much learning data a student has (shown before deleting). */
  async dataSummary(studentId: string): Promise<StudentDataSummary> {
    const [lists, mistakes, sessions] = await Promise.all([
      this.studentData.lists.countForStudent(studentId),
      this.studentData.mistakes.countForStudent(studentId),
      this.studentData.sessions.countForStudent(studentId),
    ]);
    return { lists, mistakes, sessions };
  }

  /** Permanently delete a student and all of their learning data. Other students are untouched. */
  async remove(studentId: string): Promise<void> {
    const student = await this.students.getById(studentId);
    if (!student) throw new ServiceError("student.notFound");
    // Data first: if anything fails, the profile still exists and the delete can be retried.
    for (const store of Object.values(this.studentData)) await store.removeAllForStudent(studentId);
    await this.students.remove(studentId);
    await this.clearCurrentIf(studentId);
  }

  private validName(raw: string, others: StudentProfile[]): string {
    const name = raw.trim();
    if (!name) throw new ServiceError("student.nameRequired");
    if (name.length > STUDENT_NAME_MAX_LENGTH) throw new ServiceError("student.nameTooLong");
    if (others.some((s) => sameName(s.name, name))) throw new ServiceError("student.nameTaken");
    return name;
  }

  private async clearCurrentIf(studentId: string) {
    const settings = await this.settings.get();
    if (settings.currentStudentId === studentId) await this.settings.save({ ...settings, currentStudentId: null });
  }
}
