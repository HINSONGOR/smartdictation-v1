import type { ContentRepository, PlannerSettingsRepository, PracticeRepository, TaskRepository } from "@/lib/data";
import { ServiceError } from "@/lib/errors";
import { createId, nowIso } from "@/lib/utils/id";
import {
  PLANNER_COLORS,
  PLANNER_SETTINGS_ID,
  TASK_LIMITS,
  type DictationList,
  type PlannerColor,
  type PlannerSettings,
  type StudentTask,
  type TaskInput,
} from "@/types";
import { autoDoneAt, categoriesOf, isDateKey, schoolYearOf, subjectsOf, type CategoryView, type SubjectView } from "./plannerRules";

export interface PlannerOptions {
  categories: CategoryView[];
  subjects: SubjectView[];
}

/**
 * Student management centre: tasks per student, plus family-wide categories / subjects.
 * Dictation data is only read (to link tasks and to mark linked tasks done) — never changed.
 */
export class PlannerService {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly settings: PlannerSettingsRepository,
    private readonly practice: PracticeRepository,
    private readonly content: ContentRepository,
  ) {}

  // ---- tasks ----------------------------------------------------------------

  /** All tasks of a student. Linked tasks whose practice has happened are marked done first. */
  async listTasks(studentId: string): Promise<StudentTask[]> {
    const [tasks, sessions] = await Promise.all([this.tasks.listByStudent(studentId), this.practice.listByStudent(studentId)]);
    const result: StudentTask[] = [];
    for (const task of tasks) {
      const at = autoDoneAt(task, sessions);
      if (!at) {
        result.push(task);
        continue;
      }
      const done: StudentTask = { ...task, done: true, doneAt: at, updatedAt: nowIso() };
      await this.tasks.save(done);
      result.push(done);
    }
    return result;
  }

  async getTask(studentId: string, taskId: string): Promise<StudentTask | null> {
    return this.tasks.getForStudent(studentId, taskId);
  }

  async create(studentId: string, input: TaskInput): Promise<StudentTask> {
    const clean = await this.validate(input);
    const now = nowIso();
    const task: StudentTask = {
      id: createId(),
      studentId,
      ...clean,
      done: false,
      schoolYear: schoolYearOf(clean.date),
      createdAt: now,
      updatedAt: now,
    };
    await this.tasks.save(task);
    return task;
  }

  /** Add several tasks at once (e.g. from a scanned notice). All are checked before any is saved. */
  async createMany(studentId: string, inputs: TaskInput[]): Promise<StudentTask[]> {
    const clean = [];
    for (const input of inputs) clean.push(await this.validate(input));
    const now = nowIso();
    const ids = inputs.map(() => createId());
    const idByRef = new Map(inputs.flatMap((input, i) => (input.ref ? [[input.ref, ids[i]] as const] : [])));
    const tasks: StudentTask[] = clean.map((c, i) => {
      const examId = inputs[i].examRef ? idByRef.get(inputs[i].examRef!) : undefined;
      return {
        id: ids[i],
        studentId,
        ...c,
        ...(examId ? { examId } : {}),
        done: false,
        schoolYear: schoolYearOf(c.date),
        createdAt: now,
        updatedAt: now,
      };
    });
    for (const task of tasks) await this.tasks.save(task);
    return tasks;
  }

  async update(studentId: string, taskId: string, input: TaskInput): Promise<StudentTask> {
    const task = await this.tasks.getForStudent(studentId, taskId);
    if (!task) throw new ServiceError("task.notFound");
    const clean = await this.validate(input);
    // Optional fields absent from the input are cleared (the editor always sends the whole task).
    const { subjectId: _s, time: _t, minutes: _m, notes: _n, link: _l, ...kept } = task;
    void [_s, _t, _m, _n, _l];
    const updated: StudentTask = { ...kept, ...clean, schoolYear: schoolYearOf(clean.date), updatedAt: nowIso() };
    await this.tasks.save(updated);
    return updated;
  }

  async setDone(studentId: string, taskId: string, done: boolean): Promise<StudentTask> {
    const task = await this.tasks.getForStudent(studentId, taskId);
    if (!task) throw new ServiceError("task.notFound");
    const now = nowIso();
    const updated: StudentTask = { ...task, done, updatedAt: now };
    if (done) updated.doneAt = now;
    else delete updated.doneAt;
    await this.tasks.save(updated);
    return updated;
  }

  async remove(studentId: string, taskId: string): Promise<void> {
    await this.tasks.removeForStudent(studentId, taskId);
  }

  /** Dictation lists a task can link to. */
  async linkableLists(studentId: string): Promise<DictationList[]> {
    return (await this.content.listByStudent(studentId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private async validate(input: TaskInput): Promise<TaskInput> {
    const title = input.title.trim();
    if (!title) throw new ServiceError("task.titleRequired");
    if (title.length > TASK_LIMITS.titleMaxLength) throw new ServiceError("task.titleTooLong");
    if (!isDateKey(input.date)) throw new ServiceError("task.dateInvalid");
    const { categories, subjects } = await this.options();
    if (!categories.some((c) => c.id === input.categoryId)) throw new ServiceError("task.categoryInvalid");
    const notes = input.notes?.trim();
    if (notes && notes.length > TASK_LIMITS.notesMaxLength) throw new ServiceError("task.notesTooLong");
    const minutes = input.minutes;
    if (minutes !== undefined && (!Number.isInteger(minutes) || minutes < 1 || minutes > TASK_LIMITS.maxMinutes)) {
      throw new ServiceError("task.minutesInvalid");
    }

    const clean: TaskInput = { title, categoryId: input.categoryId, date: input.date };
    if (input.subjectId && subjects.some((s) => s.id === input.subjectId)) clean.subjectId = input.subjectId;
    if (input.time && /^\d{2}:\d{2}$/.test(input.time)) clean.time = input.time;
    if (minutes !== undefined) clean.minutes = minutes;
    if (notes) clean.notes = notes;
    if (input.link) clean.link = input.link;
    return clean;
  }

  // ---- family categories & subjects -------------------------------------------

  async options(): Promise<PlannerOptions> {
    const settings = await this.settings.get();
    return { categories: categoriesOf(settings), subjects: subjectsOf(settings) };
  }

  async addCategory(name: string, icon: string, color: PlannerColor): Promise<void> {
    const settings = await this.current();
    const clean = this.validName(name, settings.categories.map((c) => c.name), settings.categories.length, TASK_LIMITS.maxCustomCategories);
    const category = { id: `c-${createId()}`, name: clean, icon: icon.trim() || "⭐", color: this.validColor(color) };
    await this.save({ ...settings, categories: [...settings.categories, category] });
  }

  /** Tasks of a removed category show as "other" (their data is kept). */
  async removeCategory(id: string): Promise<void> {
    const settings = await this.current();
    await this.save({ ...settings, categories: settings.categories.filter((c) => c.id !== id) });
  }

  async addSubject(name: string, color: PlannerColor): Promise<void> {
    const settings = await this.current();
    const clean = this.validName(name, settings.subjects.map((s) => s.name), settings.subjects.length, TASK_LIMITS.maxCustomSubjects);
    await this.save({ ...settings, subjects: [...settings.subjects, { id: `s-${createId()}`, name: clean, color: this.validColor(color) }] });
  }

  /** Tasks keep the removed subject id; they just show no subject. */
  async removeSubject(id: string): Promise<void> {
    const settings = await this.current();
    await this.save({ ...settings, subjects: settings.subjects.filter((s) => s.id !== id) });
  }

  private async current(): Promise<PlannerSettings> {
    return (await this.settings.get()) ?? { id: PLANNER_SETTINGS_ID, categories: [], subjects: [], updatedAt: nowIso() };
  }

  private save(settings: PlannerSettings) {
    return this.settings.save({ ...settings, updatedAt: nowIso() });
  }

  private validName(raw: string, taken: string[], count: number, max: number): string {
    const name = raw.trim();
    if (!name) throw new ServiceError("planner.nameRequired");
    if (name.length > TASK_LIMITS.categoryNameMaxLength) throw new ServiceError("planner.nameTooLong");
    if (taken.some((t) => t.trim().toLowerCase() === name.toLowerCase())) throw new ServiceError("planner.nameTaken");
    if (count >= max) throw new ServiceError("planner.limitReached");
    return name;
  }

  private validColor(color: PlannerColor): PlannerColor {
    return PLANNER_COLORS.includes(color) ? color : "gray";
  }
}
