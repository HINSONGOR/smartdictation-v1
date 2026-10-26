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
  REPEAT_HORIZON_DAYS,
  REPEAT_LOOKBACK_DAYS,
  type DateKey,
  type RepeatRule,
  type StudentTask,
  type TaskInput,
} from "@/types";
import {
  addDays,
  autoDoneAt,
  categoriesOf,
  dateKey,
  isDateKey,
  occurrenceDays,
  occurrenceId,
  repeatsOn,
  schoolYearOf,
  subjectsOf,
  type CategoryView,
  type SubjectView,
} from "./plannerRules";

/** For one day of a repeating task: only this day, or this day and later. */
export type RepeatScope = "one" | "future";

/** Task fields after validation (no repeat / batch names). */
type TaskFields = Omit<TaskInput, "repeat" | "ref" | "examRef">;

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

  /**
   * All tasks of a student (repeating tasks' hidden templates left out).
   * Each repeating task first gets its copies for the next days; linked tasks whose practice
   * has happened are marked done.
   */
  async listTasks(studentId: string, today: DateKey = dateKey(new Date())): Promise<StudentTask[]> {
    const [stored, sessions] = await Promise.all([this.tasks.listByStudent(studentId), this.practice.listByStudent(studentId)]);
    const tasks = this.withOccurrences(stored, today);
    const result: StudentTask[] = [];
    for (const task of tasks) {
      if (task.repeat) continue;
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
    return this.findTask(studentId, taskId);
  }

  /** The hidden template of a repeating task (to show / edit its repeat settings). */
  async getRoutine(studentId: string, routineId: string): Promise<StudentTask | null> {
    const template = await this.tasks.getForStudent(studentId, routineId);
    return template?.repeat ? template : null;
  }

  /** A task with `repeat` becomes a repeating task starting on its date. */
  async create(studentId: string, input: TaskInput): Promise<StudentTask> {
    const clean = await this.validate(input);
    const repeat = this.validRepeat(input.repeat, clean.date);
    const now = nowIso();
    const task: StudentTask = {
      id: createId(),
      studentId,
      ...clean,
      ...(repeat ? { repeat } : {}),
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

  /**
   * Save changes. For one day of a repeating task, `scope` decides:
   * "one" = only this day; "future" = this day and later (the repeat settings change too).
   */
  async update(studentId: string, taskId: string, input: TaskInput, scope: RepeatScope = "one"): Promise<StudentTask> {
    const task = await this.findTask(studentId, taskId);
    if (!task) throw new ServiceError("task.notFound");
    const clean = await this.validate(input);

    const template = task.routineId && scope === "future" ? await this.getRoutine(studentId, task.routineId) : null;
    if (template?.repeat) {
      if (input.repeat) {
        const day = task.date;
        const { skip, pausedUntil } = template.repeat;
        const keep = (rule: RepeatRule): RepeatRule => {
          const laterSkips = skip?.filter((d) => d >= rule.start);
          return { ...rule, ...(laterSkips?.length ? { skip: laterSkips } : {}), ...(pausedUntil ? { pausedUntil } : {}) };
        };
        if (day <= template.repeat.start) {
          // From the very first day: change the whole repeat in place.
          const rule = keep(this.validRepeat(input.repeat, template.repeat.start)!);
          await this.saveTask({ ...this.withFields(template, { ...clean, date: template.date }), repeat: rule });
          await this.removeOpenOccurrences(studentId, template.id, day);
          return task.done ? this.saveTask(this.withFields(task, { ...clean, date: day })) : task;
        }
        // From a later day: earlier days keep the old settings; a new repeat starts on this day.
        const now = nowIso();
        const rule = keep(this.validRepeat(input.repeat, day)!);
        // Never past the old repeat's end (later days may already belong to another repeat).
        const oldEnd = template.repeat.end;
        if (oldEnd && (!rule.end || rule.end > oldEnd)) rule.end = oldEnd;
        const next: StudentTask = {
          ...this.withFields({ ...template, id: createId(), createdAt: now }, { ...clean, date: day }),
          repeat: rule,
          updatedAt: now,
        };
        await this.tasks.save(next);
        await this.stopRoutine(studentId, template, day);
        // Days from here on that were already ticked move to the new repeat (with the new details).
        for (const t of await this.tasks.listByStudent(studentId)) {
          if (t.routineId !== template.id || t.date < day) continue;
          await this.tasks.removeForStudent(studentId, t.id);
          await this.saveTask({ ...this.withFields(t, { ...clean, date: t.date }), id: occurrenceId(next.id, t.date), routineId: next.id });
        }
        return next;
      }
      // Switched to "不重複": the repeat ends before this day, which stays as a normal task.
      await this.stopRoutine(studentId, template, task.date);
      const { routineId: _r, ...plain } = task;
      void _r;
      return this.saveTask(this.withFields(plain, clean));
    }

    if (!task.routineId && !task.repeat && input.repeat) {
      // A normal task becoming a repeating one.
      const created = await this.create(studentId, input);
      await this.tasks.removeForStudent(studentId, task.id);
      return created;
    }
    return this.saveTask(this.withFields(task, clean));
  }

  /** Stop a repeating task on holidays: no tasks up to `until` (null = carry on). */
  async pauseRoutine(studentId: string, routineId: string, until: DateKey | null, today: DateKey = dateKey(new Date())): Promise<void> {
    const template = await this.getRoutine(studentId, routineId);
    if (!template?.repeat) throw new ServiceError("task.notFound");
    if (until !== null && !isDateKey(until)) throw new ServiceError("task.dateInvalid");
    const { pausedUntil: _p, ...rule } = template.repeat;
    void _p;
    await this.saveTask({ ...template, repeat: until ? { ...rule, pausedUntil: until } : rule });
    if (until) {
      for (const t of await this.tasks.listByStudent(studentId)) {
        if (t.routineId === routineId && !t.done && t.date >= today && t.date <= until) await this.tasks.removeForStudent(studentId, t.id);
      }
    }
  }

  async setDone(studentId: string, taskId: string, done: boolean): Promise<StudentTask> {
    const task = await this.findTask(studentId, taskId);
    if (!task) throw new ServiceError("task.notFound");
    const now = nowIso();
    const updated: StudentTask = { ...task, done, updatedAt: now };
    if (done) updated.doneAt = now;
    else delete updated.doneAt;
    await this.tasks.save(updated);
    return updated;
  }

  /** For one day of a repeating task: "one" = skip only this day; "future" = stop from this day on. */
  async remove(studentId: string, taskId: string, scope: RepeatScope = "one"): Promise<void> {
    const task = await this.findTask(studentId, taskId);
    const template = task?.routineId ? await this.getRoutine(studentId, task.routineId) : null;
    if (task && template?.repeat) {
      if (scope === "one") {
        await this.saveTask({ ...template, repeat: { ...template.repeat, skip: [...(template.repeat.skip ?? []), task.date] } });
      } else {
        await this.stopRoutine(studentId, template, task.date);
      }
    }
    await this.tasks.removeForStudent(studentId, taskId);
  }

  // ---- repeating tasks (internal) --------------------------------------------------

  /**
   * Add each repeating task's day copies (recent past … two weeks ahead).
   * Copies are only *shown* from the template; one is saved when it is ticked, edited or
   * deleted — so a device never uploads an untouched copy over another device's tick.
   */
  private withOccurrences(tasks: StudentTask[], today: DateKey): StudentTask[] {
    const ids = new Set(tasks.map((t) => t.id));
    const from = addDays(today, -REPEAT_LOOKBACK_DAYS);
    const to = addDays(today, REPEAT_HORIZON_DAYS - 1);
    const shown: StudentTask[] = [];
    for (const template of tasks) {
      if (!template.repeat) continue;
      for (const day of occurrenceDays(template.repeat, from, to)) {
        if (!ids.has(occurrenceId(template.id, day))) shown.push(this.occurrence(template, day));
      }
    }
    return [...tasks, ...shown];
  }

  /** One day's copy of a repeating task (not saved). */
  private occurrence(template: StudentTask, day: DateKey): StudentTask {
    const { repeat: _r, doneAt: _d, ...fields } = template;
    void [_r, _d];
    return { ...fields, id: occurrenceId(template.id, day), routineId: template.id, date: day, done: false, schoolYear: schoolYearOf(day) };
  }

  /** A saved task, or a repeating task's not-yet-saved copy for its day. */
  private async findTask(studentId: string, taskId: string): Promise<StudentTask | null> {
    const stored = await this.tasks.getForStudent(studentId, taskId);
    if (stored) return stored;
    const [templateId, day] = taskId.split("~");
    if (!day) return null;
    const template = await this.getRoutine(studentId, templateId);
    return template?.repeat && repeatsOn(template.repeat, day) ? this.occurrence(template, day) : null;
  }

  /** End a repeating task the day before `day`, removing its open copies from `day` on. */
  private async stopRoutine(studentId: string, template: StudentTask, day: DateKey) {
    const end = addDays(day, -1);
    if (end < template.repeat!.start) await this.tasks.removeForStudent(studentId, template.id);
    else await this.saveTask({ ...template, repeat: { ...template.repeat!, end } });
    await this.removeOpenOccurrences(studentId, template.id, day);
  }

  private async removeOpenOccurrences(studentId: string, routineId: string, from: DateKey) {
    for (const t of await this.tasks.listByStudent(studentId)) {
      if (t.routineId === routineId && !t.done && t.date >= from) await this.tasks.removeForStudent(studentId, t.id);
    }
  }

  /** The task with the editor's fields (optional ones missing from `clean` are cleared). */
  private withFields(task: StudentTask, clean: TaskFields): StudentTask {
    const { subjectId: _s, time: _t, minutes: _m, notes: _n, link: _l, ...kept } = task;
    void [_s, _t, _m, _n, _l];
    return { ...kept, ...clean, schoolYear: schoolYearOf(clean.date) };
  }

  private async saveTask(task: StudentTask): Promise<StudentTask> {
    const updated = { ...task, updatedAt: nowIso() };
    await this.tasks.save(updated);
    return updated;
  }

  private validRepeat(repeat: TaskInput["repeat"], start: DateKey): RepeatRule | undefined {
    if (!repeat) return undefined;
    const kind = repeat.kind;
    if (kind !== "daily" && kind !== "schoolDays" && kind !== "weekly") return undefined;
    const rule: RepeatRule = { kind, start };
    if (kind === "weekly") {
      const days = [...new Set(repeat.weekdays ?? [])].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
      if (days.length === 0) throw new ServiceError("task.weekdaysRequired");
      rule.weekdays = days;
    }
    if (repeat.end) {
      if (!isDateKey(repeat.end)) throw new ServiceError("task.dateInvalid");
      if (repeat.end < start) throw new ServiceError("task.endBeforeStart");
      rule.end = repeat.end;
    }
    return rule;
  }

  /** Dictation lists a task can link to. */
  async linkableLists(studentId: string): Promise<DictationList[]> {
    return (await this.content.listByStudent(studentId)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  private async validate(input: TaskInput): Promise<TaskFields> {
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

    const clean: TaskFields = { title, categoryId: input.categoryId, date: input.date };
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
