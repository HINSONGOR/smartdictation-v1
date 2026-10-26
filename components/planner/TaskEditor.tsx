"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorText, TextInput } from "@/components/ui/TextInput";
import { errorMessage, type MessageKey } from "@/lib/i18n";
import { dateKey } from "@/lib/planner/plannerRules";
import type { PlannerOptions, RepeatScope } from "@/lib/planner/PlannerService";
import { scopeFromNotes } from "@/lib/scan/scanItems";
import { TASK_LIMITS, type DateKey, type DictationList, type KnowledgeItem, type RepeatKind, type StudentTask, type TaskLink } from "@/types";
import { COLOR_HEX, categoryName, formatDay, plannerRoutes, subjectName } from "./plannerUi";

const TEXTAREA =
  "w-full rounded-control border border-border bg-surface p-3 text-base text-foreground placeholder:text-muted focus:outline-2 focus:outline-primary";
const MINUTE_CHOICES = [10, 15, 20, 30, 45, 60];

/** Link choice in the <select>: "", "list:<id>", "review:zh", "review:en", "know:<id>". */
function linkValue(link?: TaskLink): string {
  if (!link) return "";
  if (link.kind === "dictationList") return `list:${link.listId}`;
  if (link.kind === "mistakeReview") return `review:${link.language}`;
  return `know:${link.itemId}`;
}

function parseLink(value: string, lists: DictationList[], knowledge: KnowledgeItem[]): TaskLink | undefined {
  if (value.startsWith("list:")) {
    const list = lists.find((l) => l.id === value.slice(5));
    return list ? { kind: "dictationList", listId: list.id, language: list.language } : undefined;
  }
  if (value === "review:zh" || value === "review:en") return { kind: "mistakeReview", language: value.slice(7) as "zh" | "en" };
  if (value.startsWith("know:")) {
    const item = knowledge.find((k) => k.id === value.slice(5));
    return item ? { kind: "knowledge", itemId: item.id } : undefined;
  }
  return undefined;
}

interface Loaded {
  options: PlannerOptions;
  lists: DictationList[];
  knowledge: KnowledgeItem[];
  task: StudentTask | null;
  /** For one day of a repeating task: its template (repeat settings). */
  routine: StudentTask | null;
}

type RepeatChoice = "none" | RepeatKind;
/** Monday-first, as shown; values are Date.getDay() numbers. */
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];

/** Add / edit one task of the current student. */
export function TaskEditor({ studentId, taskId, date }: { studentId: string; taskId: string | null; date: DateKey | null }) {
  const { t, services } = useApp();
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    Promise.all([
      services.planner.options(),
      services.planner.linkableLists(studentId),
      services.knowledge.list(studentId),
      taskId ? services.planner.getTask(studentId, taskId) : Promise.resolve(null),
    ]).then(async ([options, lists, knowledge, task]) => {
      if (taskId && !task) return setMissing(true);
      const routine = task?.routineId ? await services.planner.getRoutine(studentId, task.routineId) : null;
      setLoaded({ options, lists, knowledge, task, routine });
    });
  }, [services, studentId, taskId]);

  if (missing) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-muted">{t("error.task.notFound")}</p>
        <Button variant="secondary" onClick={() => router.push(plannerRoutes.home())}>
          {t("planner.back")}
        </Button>
      </Card>
    );
  }
  if (!loaded) return <p className="text-sm text-muted">{t("app.loading")}</p>;
  return <TaskForm studentId={studentId} loaded={loaded} initialDate={date} />;
}

function TaskForm({ studentId, loaded, initialDate }: { studentId: string; loaded: Loaded; initialDate: DateKey | null }) {
  const { t, services, settings } = useApp();
  const router = useRouter();
  const { options, lists, knowledge, task, routine } = loaded;
  const rule = routine?.repeat;

  const [title, setTitle] = useState(task?.title ?? "");
  const [categoryId, setCategoryId] = useState(task?.categoryId ?? "homework");
  const [subjectId, setSubjectId] = useState(task?.subjectId ?? "");
  const [date, setDate] = useState(task?.date ?? initialDate ?? dateKey(new Date()));
  const [time, setTime] = useState(task?.time ?? "");
  const [minutes, setMinutes] = useState(task?.minutes ? String(task.minutes) : "");
  const [link, setLink] = useState(linkValue(task?.link));
  // Older scanned exams kept "範圍：…" in their notes — shown here in the scope box instead.
  const legacy = task?.scope?.length ? { scope: task.scope, notes: task.notes ?? "" } : scopeFromNotes(task?.notes);
  const [notes, setNotes] = useState(legacy.notes);
  const [scopeText, setScopeText] = useState(legacy.scope.join("\n"));
  const isExam = categoryId === "exam" || categoryId === "dictation";
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [repeat, setRepeat] = useState<RepeatChoice>(rule?.kind ?? "none");
  const [weekdays, setWeekdays] = useState<number[]>(rule?.weekdays ?? []);
  const [repeatEnd, setRepeatEnd] = useState(rule?.end ?? "");
  /** One day of a repeating task: change only this day, or this day and later. */
  const [scope, setScope] = useState<RepeatScope>("one");
  const [pauseUntil, setPauseUntil] = useState("");

  const back = () => router.push(plannerRoutes.home());
  const isOccurrence = Boolean(routine);
  /** Repeat settings apply when creating, editing a normal task, or "this day and later". */
  const repeatEditable = !isOccurrence || scope === "future";

  async function pause(until: string | null) {
    if (!routine) return;
    try {
      await services.planner.pauseRoutine(studentId, routine.id, until);
      back();
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  function chooseLink(value: string) {
    setLink(value);
    const chosen = parseLink(value, lists, knowledge);
    if (chosen?.kind === "dictationList") {
      const list = lists.find((l) => l.id === chosen.listId)!;
      setCategoryId("dictation");
      setSubjectId(list.language === "zh" ? "chinese" : "english");
      if (!title.trim()) setTitle(t(list.language === "zh" ? "planner.titleZhDictation" : "planner.titleEnDictation", { title: list.title }));
    } else if (chosen?.kind === "mistakeReview" && !title.trim()) {
      setTitle(t(chosen.language === "zh" ? "planner.titleZhReview" : "planner.titleEnReview"));
      setCategoryId("revision");
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input = {
      title,
      categoryId,
      subjectId: subjectId || undefined,
      date,
      time: time || undefined,
      minutes: minutes ? Number(minutes) : undefined,
      notes,
      scope: isExam ? scopeText.split("\n") : [],
      link: parseLink(link, lists, knowledge),
      repeat:
        repeatEditable && repeat !== "none"
          ? { kind: repeat, ...(repeat === "weekly" ? { weekdays } : {}), ...(repeatEnd ? { end: repeatEnd } : {}) }
          : undefined,
    };
    try {
      if (task) await services.planner.update(studentId, task.id, input, scope);
      else await services.planner.create(studentId, input);
      back();
    } catch (err) {
      setError(errorMessage(t, err));
      setSaving(false);
    }
  }

  async function remove(removeScope: RepeatScope = "one") {
    if (!task) return;
    await services.planner.remove(studentId, task.id, removeScope);
    back();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <PageHeader title={t(task ? "planner.editTitle" : "planner.newTitle")} />

      {isOccurrence && task && (
        <Card className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t("repeat.isRepeating")}</p>
          <ChipGroup
            label={t("repeat.scope")}
            value={scope}
            onChange={(v) => setScope(v as RepeatScope)}
            options={[
              { value: "one", label: t("repeat.scopeOne", { date: formatDay(task.date, settings.locale) }) },
              { value: "future", label: t("repeat.scopeFuture") },
            ]}
          />
        </Card>
      )}

      <Card className="space-y-4">
        <div>
          <label htmlFor="task-title" className="mb-1 block text-sm font-medium text-foreground">
            {t("planner.fieldTitle")}
          </label>
          <TextInput
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("planner.titlePlaceholder")}
            maxLength={TASK_LIMITS.titleMaxLength}
          />
        </div>

        <ChipGroup
          label={t("planner.fieldCategory")}
          value={categoryId}
          onChange={setCategoryId}
          options={options.categories.map((c) => ({ value: c.id, label: `${c.icon} ${categoryName(t, c)}`, color: COLOR_HEX[c.color] }))}
        />

        <ChipGroup
          label={t("planner.fieldSubject")}
          value={subjectId}
          onChange={setSubjectId}
          options={[
            { value: "", label: t("planner.noSubject") },
            ...options.subjects.map((s) => ({ value: s.id, label: subjectName(t, s), color: COLOR_HEX[s.color] })),
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-date" className="mb-1 block text-sm font-medium text-foreground">
              {t("planner.fieldDate")}
            </label>
            <TextInput
              id="task-date"
              type="date"
              required
              value={date}
              disabled={isOccurrence && scope === "future"}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="task-time" className="mb-1 block text-sm font-medium text-foreground">
              {t("planner.fieldTime")}
            </label>
            <TextInput id="task-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>

        {repeatEditable && (
          <div className="space-y-2 rounded-control bg-surface-muted p-3">
            <ChipGroup
              label={t("repeat.label")}
              value={repeat}
              onChange={(v) => setRepeat(v as RepeatChoice)}
              options={[
                { value: "none", label: t("repeat.none") },
                { value: "daily", label: t("repeat.daily") },
                { value: "schoolDays", label: t("repeat.schoolDays") },
                { value: "weekly", label: t("repeat.weekly") },
              ]}
            />
            {repeat === "weekly" && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("repeat.weekdays")}>
                {WEEKDAYS.map((d) => {
                  const on = weekdays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== d) : [...w, d]))}
                      className={`size-11 rounded-full border text-sm font-medium ${on ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-foreground"}`}
                    >
                      {t(`repeat.day${d}` as MessageKey)}
                    </button>
                  );
                })}
              </div>
            )}
            {repeat !== "none" && (
              <div>
                <label htmlFor="repeat-end" className="mb-1 block text-xs text-muted">
                  {t("repeat.end")}
                </label>
                <TextInput id="repeat-end" type="date" value={repeatEnd} onChange={(e) => setRepeatEnd(e.target.value)} />
                <p className="mt-1 text-xs text-muted">{t("repeat.help")}</p>
              </div>
            )}
          </div>
        )}

        <ChipGroup
          label={t("planner.fieldMinutes")}
          value={minutes}
          onChange={setMinutes}
          options={[
            { value: "", label: t("planner.noMinutes") },
            ...MINUTE_CHOICES.map((n) => ({ value: String(n), label: t("planner.minutes", { n }) })),
          ]}
        />

        <div>
          <label htmlFor="task-link" className="mb-1 block text-sm font-medium text-foreground">
            {t("planner.fieldLink")}
          </label>
          <select
            id="task-link"
            value={link}
            onChange={(e) => chooseLink(e.target.value)}
            className="min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-foreground"
          >
            <option value="">{t("planner.noLink")}</option>
            {(["zh", "en"] as const).map((language) => {
              const ofLanguage = lists.filter((l) => l.language === language);
              return ofLanguage.length ? (
                <optgroup key={language} label={t(language === "zh" ? "nav.chinese" : "nav.english")}>
                  {ofLanguage.map((l) => (
                    <option key={l.id} value={`list:${l.id}`}>
                      {l.title}
                    </option>
                  ))}
                </optgroup>
              ) : null;
            })}
            <optgroup label={t("nav.mistakes")}>
              <option value="review:zh">{t("planner.titleZhReview")}</option>
              <option value="review:en">{t("planner.titleEnReview")}</option>
            </optgroup>
            {knowledge.length > 0 && (
              <optgroup label={t("nav.knowledge")}>
                {knowledge.map((k) => (
                  <option key={k.id} value={`know:${k.id}`}>
                    {t(`knowledge.kindIcon.${k.kind}` as MessageKey)} {k.topic ? `${k.topic} · ` : ""}
                    {k.title}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="mt-1 text-xs text-muted">{t("planner.linkHelp")}</p>
        </div>

        {isExam && (
          <div>
            <label htmlFor="task-scope" className="mb-1 block text-sm font-medium text-foreground">
              {t("planner.fieldScope")}
            </label>
            <textarea
              id="task-scope"
              value={scopeText}
              onChange={(e) => setScopeText(e.target.value)}
              rows={Math.min(Math.max(scopeText.split("\n").length + 1, 3), 10)}
              placeholder={t("planner.scopePlaceholder")}
              className={TEXTAREA}
            />
            <p className="mt-1 text-xs text-muted">{t("planner.scopeHelp")}</p>
          </div>
        )}

        <div>
          <label htmlFor="task-notes" className="mb-1 block text-sm font-medium text-foreground">
            {t("planner.fieldNotes")}
          </label>
          <textarea
            id="task-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={TASK_LIMITS.notesMaxLength}
            className={TEXTAREA}
          />
        </div>
      </Card>

      <Card className="space-y-3">
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={saving}>
            {t("planner.save")}
          </Button>
          <Button variant="secondary" onClick={back}>
            {t("planner.cancel")}
          </Button>
          {task && !confirmDelete && (
            <Button variant="dangerGhost" className="ml-auto" onClick={() => setConfirmDelete(true)}>
              {t("planner.delete")}
            </Button>
          )}
        </div>
        {task && confirmDelete && (
          <div role="alertdialog" className="space-y-2 rounded-control border border-danger p-3">
            <p className="text-sm text-foreground">{t("planner.deleteConfirm", { title: task.title })}</p>
            <div className="flex flex-wrap gap-2">
              {isOccurrence ? (
                <>
                  <Button variant="danger" onClick={() => remove("one")}>
                    {t("repeat.deleteOne")}
                  </Button>
                  <Button variant="danger" onClick={() => remove("future")}>
                    {t("repeat.deleteFuture")}
                  </Button>
                </>
              ) : (
                <Button variant="danger" onClick={() => remove()}>
                  {t("planner.deleteYes")}
                </Button>
              )}
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t("planner.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {routine && rule && (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{t("repeat.pauseTitle")}</h2>
          {rule.pausedUntil && rule.pausedUntil >= dateKey(new Date()) ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-foreground">{t("repeat.pausedUntil", { date: formatDay(rule.pausedUntil, settings.locale) })}</p>
              <Button variant="secondary" onClick={() => pause(null)}>
                {t("repeat.resume")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="pause-until" className="mb-1 block text-xs text-muted">
                  {t("repeat.pauseUntil")}
                </label>
                <TextInput id="pause-until" type="date" value={pauseUntil} onChange={(e) => setPauseUntil(e.target.value)} />
              </div>
              <Button variant="secondary" disabled={!pauseUntil} onClick={() => pause(pauseUntil)}>
                {t("repeat.pause")}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted">{t("repeat.pauseHelp")}</p>
        </Card>
      )}
    </form>
  );
}

function ChipGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; color?: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-foreground">{label}</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm ${
                selected ? "border-primary bg-primary-soft font-medium text-foreground ring-2 ring-primary" : "border-border bg-surface text-foreground"
              }`}
            >
              {option.color && <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: option.color }} />}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
