"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { COLOR_HEX, subjectName } from "@/components/planner/plannerUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TextInput } from "@/components/ui/TextInput";
import type { SubjectView } from "@/lib/planner/plannerRules";
import { blanksOf, fillBlanks } from "@/lib/prompts/promptText";
import { PromptService } from "@/lib/prompts/PromptService";
import { SAMPLE_PROMPTS } from "@/lib/prompts/samples";
import type { StudentSummary } from "@/lib/student/StudentService";
import { PROMPT_PURPOSES, type PromptEntry, type PromptPurpose } from "@/types";
import { AI_LINKS, aiLabel, copyText, promptRoutes, purposeLabel } from "./promptUi";

type Owner = "all" | "family" | "mine";

/** AI 指令收納庫: search, filter, fill in blanks, copy, and open an AI. */
export function PromptLibrary({ student }: { student: StudentSummary }) {
  const { t, services, dataVersion } = useApp();
  const [prompts, setPrompts] = useState<PromptEntry[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectView[]>([]);
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<Owner>("all");
  const [purpose, setPurpose] = useState<PromptPurpose | "">("");
  const [subjectId, setSubjectId] = useState("");

  useEffect(() => {
    services.prompts.list(student.id).then(setPrompts);
    services.planner.options().then((o) => setSubjects(o.subjects));
  }, [services, student.id, dataVersion]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (prompts ?? []).filter(
      (p) =>
        (owner === "all" || (owner === "family" ? p.ownerStudentId === null : p.ownerStudentId === student.id)) &&
        (!purpose || p.purpose === purpose) &&
        (!subjectId || p.subjectId === subjectId) &&
        (!q || p.title.toLowerCase().includes(q) || p.content.toLowerCase().includes(q)),
    );
  }, [prompts, query, owner, purpose, subjectId, student.id]);

  async function addSample(index: number) {
    await services.prompts.create(student.id, { ...SAMPLE_PROMPTS[index], shared: true });
    setPrompts(await services.prompts.list(student.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <PageHeader title={t("nav.prompts")}>{t("prompts.intro")}</PageHeader>
        <Link
          href={promptRoutes.create()}
          className="inline-flex min-h-11 shrink-0 items-center rounded-control bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          {t("prompts.add")}
        </Link>
      </div>

      {prompts && prompts.length > 0 && (
        <Card className="space-y-3">
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("prompts.search")} aria-label={t("prompts.search")} type="search" />
          <div className="flex flex-wrap gap-2">
            <Chips
              label={t("prompts.filterOwner")}
              value={owner}
              onChange={(v) => setOwner(v as Owner)}
              options={[
                { value: "all", label: t("prompts.ownerAll") },
                { value: "family", label: t("prompts.ownerFamily") },
                { value: "mine", label: t("prompts.ownerMine") },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as PromptPurpose | "")}
              aria-label={t("prompts.purpose")}
              className="min-h-11 rounded-control border border-border bg-surface px-3 text-base text-foreground"
            >
              <option value="">{t("prompts.allPurposes")}</option>
              {PROMPT_PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {purposeLabel(t, p)}
                </option>
              ))}
            </select>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              aria-label={t("planner.fieldSubject")}
              className="min-h-11 rounded-control border border-border bg-surface px-3 text-base text-foreground"
            >
              <option value="">{t("prompts.allSubjects")}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {subjectName(t, s)}
                </option>
              ))}
            </select>
          </div>
        </Card>
      )}

      {!prompts ? (
        <p className="text-sm text-muted">{t("app.loading")}</p>
      ) : prompts.length === 0 ? (
        <div className="space-y-3">
          <Card className="space-y-1">
            <p className="font-medium text-foreground">{t("prompts.emptyTitle")}</p>
            <p className="text-sm text-muted">{t("prompts.emptyHint")}</p>
          </Card>
          <Samples have={prompts} onAdd={addSample} />
        </div>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">{t("prompts.noMatch")}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((p) => (
            <PromptCard key={p.id} prompt={p} subjects={subjects} mine={p.ownerStudentId === student.id} />
          ))}
        </ul>
      )}

      {prompts && prompts.length > 0 && (
        <>
          <details className="rounded-control border border-border bg-surface p-3">
            <summary className="cursor-pointer text-sm font-semibold text-foreground">{t("prompts.samples")}</summary>
            <div className="mt-3">
              <Samples have={prompts} onAdd={addSample} />
            </div>
          </details>
          <p className="text-xs text-muted">{t("prompts.tip")}</p>
        </>
      )}
    </div>
  );
}

function PromptCard({ prompt, subjects, mine }: { prompt: PromptEntry; subjects: SubjectView[]; mine: boolean }) {
  const { t } = useApp();
  const [using, setUsing] = useState(false);
  const subject = subjects.find((s) => s.id === prompt.subjectId);

  return (
    <li className="space-y-3 rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <h2 className="min-w-0 font-semibold text-foreground">{prompt.title}</h2>
        <Link href={promptRoutes.edit(prompt.id)} className="shrink-0 text-sm font-medium text-primary hover:underline">
          {t("prompts.edit")}
        </Link>
      </div>
      <div className="flex flex-wrap gap-1.5 text-xs">
        <Badge>{mine ? t("prompts.badgeMine") : t("prompts.badgeFamily")}</Badge>
        {subject && (
          <Badge>
            <span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full" style={{ backgroundColor: COLOR_HEX[subject.color] }} />
            {subjectName(t, subject)}
          </Badge>
        )}
        <Badge>{purposeLabel(t, prompt.purpose)}</Badge>
        <Badge>{aiLabel(t, prompt.ai)}</Badge>
        <Badge>v{PromptService.versionOf(prompt)}</Badge>
      </div>
      {!using && <p className="line-clamp-3 text-sm whitespace-pre-line text-muted">{prompt.content}</p>}
      {using ? <UsePrompt prompt={prompt} onClose={() => setUsing(false)} /> : <Button onClick={() => setUsing(true)}>{t("prompts.use")}</Button>}
    </li>
  );
}

/** Fill in the blanks, see the finished prompt, copy it and open an AI. */
function UsePrompt({ prompt, onClose }: { prompt: PromptEntry; onClose: () => void }) {
  const { t } = useApp();
  const blanks = blanksOf(prompt.content);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<boolean | null>(null);
  const text = fillBlanks(prompt.content, values);
  const unfilled = blanks.filter((b) => !values[b]?.trim());

  async function copy() {
    setCopied(await copyText(text));
  }

  const links = prompt.ai === "any" ? (Object.keys(AI_LINKS) as (keyof typeof AI_LINKS)[]) : [prompt.ai];

  return (
    <div className="space-y-3 rounded-control bg-surface-muted p-3">
      {blanks.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted">{t("prompts.fillHint")}</p>
          {blanks.map((name) => (
            <label key={name} className="block space-y-1">
              <span className="text-sm font-medium text-foreground">{name}</span>
              <TextInput value={values[name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))} />
            </label>
          ))}
        </div>
      )}
      <div>
        <p className="mb-1 text-xs text-muted">{t("prompts.preview")}</p>
        <p className="rounded-control border border-border bg-surface p-3 text-sm whitespace-pre-line text-foreground">{text}</p>
        {unfilled.length > 0 && <p className="mt-1 text-xs text-danger">{t("prompts.unfilled", { names: unfilled.join("、") })}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={copy}>{t("prompts.copy")}</Button>
        {links.map((ai) => (
          <a
            key={ai}
            href={AI_LINKS[ai]}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void copyText(text).then(setCopied)}
            className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-primary-soft"
          >
            {t("prompts.openAi", { ai: aiLabel(t, ai) })}
          </a>
        ))}
        <Button variant="ghost" onClick={onClose}>
          {t("prompts.close")}
        </Button>
      </div>
      {copied !== null && (
        <p role="status" className={`text-sm ${copied ? "text-success" : "text-danger"}`}>
          {t(copied ? "prompts.copied" : "prompts.copyFailed")}
        </p>
      )}
    </div>
  );
}

/** Starter prompts; ones already in the library (same title) show as added. */
function Samples({ have, onAdd }: { have: PromptEntry[]; onAdd: (index: number) => Promise<void> }) {
  const { t } = useApp();
  const titles = new Set(have.map((p) => p.title));
  return (
    <ul className="space-y-3">
      {SAMPLE_PROMPTS.map((sample, i) => {
        const added = titles.has(sample.title);
        return (
          <li key={sample.title} className="space-y-2 rounded-card border border-dashed border-border bg-surface p-4">
            <p className="font-semibold text-foreground">{sample.title}</p>
            <p className="text-sm whitespace-pre-line text-muted">{sample.content}</p>
            <Button variant="secondary" disabled={added} onClick={() => onAdd(i)}>
              {t(added ? "prompts.sampleAdded" : "prompts.addSample")}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center rounded-full bg-primary-soft px-2 py-0.5 text-foreground">{children}</span>;
}

function Chips({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-full border px-3 text-sm ${
            value === o.value ? "border-primary bg-primary-soft font-medium text-foreground" : "border-border bg-surface text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
