"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { categoryName, formatDay, plannerRoutes, subjectName } from "@/components/planner/plannerUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorText, TextInput } from "@/components/ui/TextInput";
import { createTranslator, errorMessage } from "@/lib/i18n";
import { photoFromFile } from "@/lib/ocr/photo";
import { dateKey, type SubjectView } from "@/lib/planner/plannerRules";
import type { PlannerOptions } from "@/lib/planner/PlannerService";
import { planRevision } from "@/lib/planner/revisionPlan";
import { notesFor, parseScanResult, type ScannedItem } from "@/lib/scan/scanItems";
import type { StudentSummary } from "@/lib/student/StudentService";
import { TASK_LIMITS, type DateKey, type TaskInput } from "@/types";

const PLAN_DAYS = [3, 5, 7];
const REVISION_MINUTES = 20;

type Row = ScannedItem & { plan: boolean; planDays: number };
type Phase = { kind: "pick" } | { kind: "reading" } | { kind: "review" } | { kind: "done"; added: number; revision: number };

/** Subjects can come back from the AI in either language. */
const ZH = createTranslator("zh-HK");
const EN = createTranslator("en");
const subjectNames = (s: SubjectView) => (s.builtIn ? [subjectName(ZH, s), subjectName(EN, s)] : [s.name ?? ""]);

/** 影相文件整理: photo of a notice / timetable → editable list → tasks in the management centre. */
export function ScanPage({ student }: { student: StudentSummary }) {
  const { t, services, settings } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [rows, setRows] = useState<Row[]>([]);
  const [options, setOptions] = useState<PlannerOptions | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([student]);
  const [target, setTarget] = useState(student.id);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const today: DateKey = dateKey(new Date());

  useEffect(() => {
    services.planner.options().then(setOptions);
    services.students.listSelectable().then(setStudents);
  }, [services]);

  function pickPhoto() {
    setError(null);
    if (!services.ocr.isAvailable()) {
      setError(t("error.cloud.signInRequired"));
      return;
    }
    fileRef.current?.click();
  }

  async function read(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !options) return;
    const had = rows.length > 0;
    setPhase({ kind: "reading" });
    setError(null);
    try {
      const answer = await services.ocr.readEvents(await photoFromFile(file), settings.locale === "en" ? "en" : "zh", today);
      const items = parseScanResult(answer, today, options.subjects, subjectNames);
      if (items === null) throw new Error("unreadable");
      if (items.length === 0) setError(t("scan.nothingFound"));
      const added = items.map((i) => ({ ...i, plan: i.categoryId === "exam" && i.scope.length > 0, planDays: 5 }));
      setRows((prev) => [...prev, ...added]);
      setPhase(had || added.length ? { kind: "review" } : { kind: "pick" });
    } catch (err) {
      setError(err instanceof Error && err.message === "unreadable" ? t("error.cloud.ocrFailed") : errorMessage(t, err));
      setPhase(had ? { kind: "review" } : { kind: "pick" });
    }
  }

  const update = (key: string, patch: Partial<Row>) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function buildInputs(): { inputs: TaskInput[]; revision: number } {
    const inputs: TaskInput[] = [];
    let revision = 0;
    for (const row of rows.filter((r) => r.include)) {
      inputs.push({
        title: row.title,
        categoryId: row.categoryId,
        subjectId: row.subjectId,
        date: row.date,
        time: row.time,
        notes: notesFor(row, (parts) => t("scan.scopeNote", { parts })),
      });
      if (row.plan && row.categoryId === "exam") {
        for (const day of planRevision(row.date, row.scope, today, row.planDays)) {
          inputs.push({
            title: t("scan.revisionTitle", { topics: day.topics.length ? day.topics.join("、") : t("scan.revisionAll"), exam: row.title }).slice(
              0,
              TASK_LIMITS.titleMaxLength,
            ),
            categoryId: "revision",
            subjectId: row.subjectId,
            date: day.date,
            minutes: REVISION_MINUTES,
            notes: t("scan.revisionNote", { exam: row.title, date: formatDay(row.date, settings.locale) }),
          });
          revision++;
        }
      }
    }
    return { inputs, revision };
  }

  async function addAll() {
    const { inputs, revision } = buildInputs();
    setSaving(true);
    setError(null);
    try {
      await services.planner.createMany(target, inputs);
      setPhase({ kind: "done", added: inputs.length, revision });
      setRows([]);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setSaving(false);
    }
  }

  const included = rows.filter((r) => r.include);
  const fileInput = <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={read} />;

  if (phase.kind === "done") {
    return (
      <div className="space-y-4">
        <PageHeader title={t("nav.scan")} />
        <Card className="space-y-3 text-center">
          <p className="text-4xl" aria-hidden="true">
            ✅
          </p>
          <p className="font-semibold text-foreground">{t("scan.added", { n: phase.added })}</p>
          {phase.revision > 0 && <p className="text-sm text-muted">{t("scan.addedRevision", { n: phase.revision })}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href={plannerRoutes.home()}
              className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
            >
              {t("scan.goPlanner")}
            </Link>
            <Button variant="secondary" onClick={() => setPhase({ kind: "pick" })}>
              {t("scan.again")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={t("nav.scan")}>{t("scan.intro")}</PageHeader>
      {fileInput}

      {phase.kind !== "review" && (
        <Card className="space-y-3 text-center">
          <p className="text-4xl" aria-hidden="true">
            📷
          </p>
          <Button className="min-h-12 text-base" disabled={phase.kind === "reading" || !options} onClick={pickPhoto}>
            {phase.kind === "reading" ? t("scan.reading") : t("scan.pick")}
          </Button>
          <p className="text-xs text-muted">{t("scan.tip")}</p>
          <ErrorText>{error}</ErrorText>
        </Card>
      )}

      {phase.kind === "review" && options && (
        <>
          <p className="text-sm text-muted">{t("scan.checkHint")}</p>
          <ul className="space-y-3">
            {rows.map((row) => (
              <ScanRow key={row.key} row={row} options={options} onChange={(patch) => update(row.key, patch)} />
            ))}
          </ul>

          <Card className="space-y-3">
            {students.length > 1 && (
              <div>
                <label htmlFor="scan-student" className="mb-1 block text-sm font-medium text-foreground">
                  {t("scan.forStudent")}
                </label>
                <select
                  id="scan-student"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  className="min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-foreground"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <ErrorText>{error}</ErrorText>
            <div className="flex flex-wrap gap-2">
              <Button disabled={saving || included.length === 0} onClick={addAll}>
                {t("scan.addAll", { n: included.length })}
              </Button>
              <Button variant="secondary" onClick={pickPhoto}>
                {t("scan.addPhoto")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setRows([]);
                  setPhase({ kind: "pick" });
                }}
              >
                {t("planner.cancel")}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const FIELD = "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-foreground";

function ScanRow({ row, options, onChange }: { row: Row; options: PlannerOptions; onChange: (patch: Partial<Row>) => void }) {
  const { t } = useApp();
  const id = row.key;
  return (
    <li className={`space-y-3 rounded-card border bg-surface p-4 shadow-card ${row.include ? "border-border" : "border-dashed border-border opacity-60"}`}>
      <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-foreground">
        <input
          type="checkbox"
          checked={row.include}
          onChange={(e) => onChange({ include: e.target.checked })}
          className="size-5 accent-[var(--sd-primary)]"
        />
        {t("scan.include")}
      </label>

      {row.include && (
        <>
          <TextInput
            value={row.title}
            onChange={(e) => onChange({ title: e.target.value })}
            aria-label={t("planner.fieldTitle")}
            maxLength={TASK_LIMITS.titleMaxLength}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${id}-date`} className={`mb-1 block text-xs ${row.dateMissing ? "font-semibold text-danger" : "text-muted"}`}>
                {row.dateMissing ? t("scan.dateMissing") : t("planner.fieldDate")}
              </label>
              <TextInput
                id={`${id}-date`}
                type="date"
                value={row.date}
                onChange={(e) => onChange({ date: e.target.value, dateMissing: false })}
                className={row.dateMissing ? "border-danger" : ""}
              />
            </div>
            <div>
              <label htmlFor={`${id}-time`} className="mb-1 block text-xs text-muted">
                {t("planner.fieldTime")}
              </label>
              <TextInput id={`${id}-time`} type="time" value={row.time ?? ""} onChange={(e) => onChange({ time: e.target.value || undefined })} />
            </div>
            <select
              value={row.categoryId}
              onChange={(e) => onChange({ categoryId: e.target.value })}
              aria-label={t("planner.fieldCategory")}
              className={FIELD}
            >
              {options.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {categoryName(t, c)}
                </option>
              ))}
            </select>
            <select
              value={row.subjectId ?? ""}
              onChange={(e) => onChange({ subjectId: e.target.value || undefined })}
              aria-label={t("planner.fieldSubject")}
              className={FIELD}
            >
              <option value="">{t("planner.noSubject")}</option>
              {options.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {subjectName(t, s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-scope`} className="mb-1 block text-xs text-muted">
              {t("scan.scope")}
            </label>
            <TextInput
              id={`${id}-scope`}
              value={row.scope.join("、")}
              onChange={(e) => onChange({ scope: e.target.value.split(/[、,，;；]/).map((s) => s.trim()).filter(Boolean) })}
              placeholder={t("scan.scopePlaceholder")}
            />
          </div>
          {row.notes !== undefined && (
            <div>
              <label htmlFor={`${id}-notes`} className="mb-1 block text-xs text-muted">
                {t("planner.fieldNotes")}
              </label>
              <TextInput id={`${id}-notes`} value={row.notes} onChange={(e) => onChange({ notes: e.target.value })} />
            </div>
          )}
          {row.categoryId === "exam" && (
            <div className="flex flex-wrap items-center gap-2 rounded-control bg-surface-muted p-2 text-sm text-foreground">
              <label className="flex min-h-10 items-center gap-2">
                <input
                  type="checkbox"
                  checked={row.plan}
                  onChange={(e) => onChange({ plan: e.target.checked })}
                  className="size-5 accent-[var(--sd-primary)]"
                />
                {t("scan.autoPlan")}
              </label>
              {row.plan && (
                <select
                  value={row.planDays}
                  onChange={(e) => onChange({ planDays: Number(e.target.value) })}
                  aria-label={t("scan.planDays")}
                  className="min-h-10 rounded-control border border-border bg-surface px-2"
                >
                  {PLAN_DAYS.map((d) => (
                    <option key={d} value={d}>
                      {t("scan.planDaysOption", { n: d })}
                    </option>
                  ))}
                </select>
              )}
              {row.plan && <span className="w-full text-xs text-muted">{t(row.scope.length ? "scan.autoPlanHint" : "scan.autoPlanNoScope")}</span>}
            </div>
          )}
        </>
      )}
    </li>
  );
}
