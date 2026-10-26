"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { subjectName } from "@/components/planner/plannerUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorText, TextInput } from "@/components/ui/TextInput";
import { errorMessage } from "@/lib/i18n";
import type { SubjectView } from "@/lib/planner/plannerRules";
import { blanksOf } from "@/lib/prompts/promptText";
import { PromptService } from "@/lib/prompts/PromptService";
import { PROMPT_AIS, PROMPT_LIMITS, PROMPT_PURPOSES, type PromptAi, type PromptEntry, type PromptPurpose } from "@/types";
import { aiLabel, promptRoutes, purposeLabel } from "./promptUi";

const TEXTAREA =
  "w-full rounded-control border border-border bg-surface p-3 text-base leading-7 text-foreground placeholder:text-muted focus:outline-2 focus:outline-primary";

/** Add / edit a prompt; editing shows earlier versions that can be restored. */
export function PromptEditor({ studentId, promptId }: { studentId: string; promptId: string | null }) {
  const { t, services } = useApp();
  const [loaded, setLoaded] = useState<{ prompt: PromptEntry | null; subjects: SubjectView[] } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    Promise.all([promptId ? services.prompts.get(studentId, promptId) : Promise.resolve(null), services.planner.options()]).then(
      ([prompt, options]) => {
        if (promptId && !prompt) setMissing(true);
        else setLoaded({ prompt, subjects: options.subjects });
      },
    );
  }, [services, studentId, promptId]);

  if (missing) return <p className="text-sm text-muted">{t("error.prompt.notFound")}</p>;
  if (!loaded) return <p className="text-sm text-muted">{t("app.loading")}</p>;
  return <Form key={loaded.prompt?.updatedAt ?? "new"} studentId={studentId} prompt={loaded.prompt} subjects={loaded.subjects} onReload={setLoaded} />;
}

function Form({
  studentId,
  prompt,
  subjects,
  onReload,
}: {
  studentId: string;
  prompt: PromptEntry | null;
  subjects: SubjectView[];
  onReload: (state: { prompt: PromptEntry | null; subjects: SubjectView[] }) => void;
}) {
  const { t, services, settings } = useApp();
  const router = useRouter();
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [content, setContent] = useState(prompt?.content ?? "");
  const [subjectId, setSubjectId] = useState(prompt?.subjectId ?? "");
  const [purpose, setPurpose] = useState<PromptPurpose>(prompt?.purpose ?? "study");
  const [ai, setAi] = useState<PromptAi>(prompt?.ai ?? "any");
  const [shared, setShared] = useState(prompt ? prompt.ownerStudentId === null : true);
  const [changeNote, setChangeNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openVersion, setOpenVersion] = useState<number | null>(null);

  const back = () => router.push(promptRoutes.library());
  const blanks = blanksOf(content);
  const dateTime = new Intl.DateTimeFormat(settings.locale, { dateStyle: "medium", timeStyle: "short" });

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input = { title, content, subjectId: subjectId || undefined, purpose, ai, shared, changeNote };
    try {
      if (prompt) await services.prompts.update(studentId, prompt.id, input);
      else await services.prompts.create(studentId, input);
      back();
    } catch (err) {
      setError(errorMessage(t, err));
      setSaving(false);
    }
  }

  async function restore(index: number) {
    if (!prompt) return;
    const restored = await services.prompts.restore(studentId, prompt.id, index);
    onReload({ prompt: restored, subjects });
  }

  async function remove() {
    if (!prompt) return;
    await services.prompts.remove(studentId, prompt.id);
    back();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <PageHeader title={t(prompt ? "prompts.editTitle" : "prompts.newTitle")}>
        {prompt && t("prompts.currentVersion", { v: PromptService.versionOf(prompt) })}
      </PageHeader>

      <Card className="space-y-4">
        <div>
          <label htmlFor="prompt-title" className="mb-1 block text-sm font-medium text-foreground">
            {t("prompts.fieldTitle")}
          </label>
          <TextInput id="prompt-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={PROMPT_LIMITS.titleMaxLength} />
        </div>

        <div>
          <label htmlFor="prompt-content" className="mb-1 block text-sm font-medium text-foreground">
            {t("prompts.fieldContent")}
          </label>
          <textarea
            id="prompt-content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            maxLength={PROMPT_LIMITS.contentMaxLength}
            placeholder={t("prompts.contentPlaceholder")}
            className={TEXTAREA}
          />
          <p className="mt-1 text-xs text-muted">
            {t("prompts.blankHelp")}
            {blanks.length > 0 && ` ${t("prompts.blanksFound", { names: blanks.join("、") })}`}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Select label={t("planner.fieldSubject")} value={subjectId} onChange={setSubjectId}>
            <option value="">{t("planner.noSubject")}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {subjectName(t, s)}
              </option>
            ))}
          </Select>
          <Select label={t("prompts.purpose")} value={purpose} onChange={(v) => setPurpose(v as PromptPurpose)}>
            {PROMPT_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {purposeLabel(t, p)}
              </option>
            ))}
          </Select>
          <Select label={t("prompts.fieldAi")} value={ai} onChange={(v) => setAi(v as PromptAi)}>
            {PROMPT_AIS.map((a) => (
              <option key={a} value={a}>
                {aiLabel(t, a)}
              </option>
            ))}
          </Select>
        </div>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-foreground">{t("prompts.fieldShare")}</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup">
            {[
              [true, t("prompts.shareFamily")],
              [false, t("prompts.shareMine")],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                role="radio"
                aria-checked={shared === value}
                onClick={() => setShared(value as boolean)}
                className={`min-h-11 rounded-control border px-3 text-sm ${
                  shared === value ? "border-primary bg-primary-soft font-medium text-foreground ring-2 ring-primary" : "border-border bg-surface text-foreground"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        </fieldset>

        {prompt && (
          <div>
            <label htmlFor="prompt-note" className="mb-1 block text-sm font-medium text-foreground">
              {t("prompts.fieldChangeNote")}
            </label>
            <TextInput
              id="prompt-note"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
              maxLength={PROMPT_LIMITS.noteMaxLength}
              placeholder={t("prompts.changeNotePlaceholder")}
            />
          </div>
        )}
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
          {prompt && !confirmDelete && (
            <Button variant="dangerGhost" className="ml-auto" onClick={() => setConfirmDelete(true)}>
              {t("prompts.delete")}
            </Button>
          )}
        </div>
        {prompt && confirmDelete && (
          <div role="alertdialog" className="space-y-2 rounded-control border border-danger p-3">
            <p className="text-sm text-foreground">{t("prompts.deleteConfirm", { title: prompt.title })}</p>
            <div className="flex gap-2">
              <Button variant="danger" onClick={remove}>
                {t("planner.deleteYes")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                {t("planner.cancel")}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {prompt && prompt.versions.length > 0 && (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">{t("prompts.history")}</h2>
          <ol className="space-y-2">
            {prompt.versions
              .map((version, index) => ({ version, index }))
              .reverse()
              .map(({ version, index }) => (
                <li key={index} className="space-y-2 rounded-control border border-border p-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold text-foreground">v{index + 1}</span>
                    <span className="text-xs text-muted">{dateTime.format(new Date(version.savedAt))}</span>
                    {version.note && <span className="text-xs text-foreground">· {t("prompts.changedTo", { note: version.note })}</span>}
                    <span className="ml-auto flex gap-1">
                      <Button variant="ghost" className="min-h-9 px-2" onClick={() => setOpenVersion((o) => (o === index ? null : index))}>
                        {t(openVersion === index ? "prompts.hide" : "prompts.view")}
                      </Button>
                      <Button variant="secondary" className="min-h-9 px-2" onClick={() => restore(index)}>
                        {t("prompts.restore")}
                      </Button>
                    </span>
                  </div>
                  {openVersion === index && (
                    <div className="rounded-control bg-surface-muted p-2 text-sm">
                      <p className="font-medium text-foreground">{version.title}</p>
                      <p className="whitespace-pre-line text-muted">{version.content}</p>
                    </div>
                  )}
                </li>
              ))}
          </ol>
          <p className="text-xs text-muted">{t("prompts.restoreHint")}</p>
        </Card>
      )}
    </form>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-foreground"
      >
        {children}
      </select>
    </label>
  );
}
