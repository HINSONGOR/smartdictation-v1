"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { subjectName } from "@/components/planner/plannerUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorText, TextInput } from "@/components/ui/TextInput";
import { errorMessage, type MessageKey } from "@/lib/i18n";
import type { SubjectView } from "@/lib/planner/plannerRules";
import { KNOWLEDGE_KINDS, KNOWLEDGE_LIMITS, type KnowledgeItem, type KnowledgeKind } from "@/types";
import { KIND_ICON, knowledgeRoutes } from "./knowledgeUi";

const TEXTAREA =
  "w-full rounded-control border border-border bg-surface p-3 text-base leading-7 text-foreground placeholder:text-muted focus:outline-2 focus:outline-primary";

/** Add / edit one knowledge-base item. */
export function KnowledgeEditor({ studentId, itemId, initialKind }: { studentId: string; itemId: string | null; initialKind: KnowledgeKind }) {
  const { t, services } = useApp();
  const [loaded, setLoaded] = useState<{ item: KnowledgeItem | null; subjects: SubjectView[] } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    Promise.all([itemId ? services.knowledge.get(studentId, itemId) : Promise.resolve(null), services.planner.options()]).then(([item, options]) => {
      if (itemId && !item) setMissing(true);
      else setLoaded({ item, subjects: options.subjects });
    });
  }, [services, studentId, itemId]);

  if (missing) return <p className="text-sm text-muted">{t("error.knowledge.notFound")}</p>;
  if (!loaded) return <p className="text-sm text-muted">{t("app.loading")}</p>;
  return <Form studentId={studentId} item={loaded.item} subjects={loaded.subjects} initialKind={initialKind} />;
}

function Form({ studentId, item, subjects, initialKind }: { studentId: string; item: KnowledgeItem | null; subjects: SubjectView[]; initialKind: KnowledgeKind }) {
  const { t, services } = useApp();
  const router = useRouter();
  const [kind, setKind] = useState<KnowledgeKind>(item?.kind ?? initialKind);
  const [subjectId, setSubjectId] = useState(item?.subjectId ?? "");
  const [topic, setTopic] = useState(item?.topic ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [answer, setAnswer] = useState(item?.answer ?? "");
  const [examples, setExamples] = useState((item?.examples ?? []).join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const back = (id?: string) => router.push(knowledgeRoutes.library(id));
  const label = (field: string) => t(`knowledge.field.${kind}.${field}` as MessageKey);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input = {
      kind,
      subjectId: subjectId || undefined,
      topic,
      title,
      body,
      answer,
      examples: examples.split("\n"),
      pinned: item?.pinned,
    };
    try {
      const saved = item ? await services.knowledge.update(studentId, item.id, input) : await services.knowledge.create(studentId, input);
      back(saved.id);
    } catch (err) {
      setError(errorMessage(t, err));
      setSaving(false);
    }
  }

  async function remove() {
    if (!item) return;
    await services.knowledge.remove(studentId, item.id);
    back();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <PageHeader title={t(item ? "knowledge.editTitle" : "knowledge.newTitle")} />

      <Card className="space-y-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-foreground">{t("knowledge.kind")}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
            {KNOWLEDGE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`min-h-11 rounded-control border px-3 text-sm ${
                  kind === k ? "border-primary bg-primary-soft font-medium text-foreground ring-2 ring-primary" : "border-border bg-surface text-foreground"
                }`}
              >
                {KIND_ICON[k]} {t(`knowledge.kind.${k}` as MessageKey)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">{t("planner.fieldSubject")}</span>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-foreground"
            >
              <option value="">{t("planner.noSubject")}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {subjectName(t, s)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">{t("knowledge.topic")}</span>
            <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("knowledge.topicPlaceholder")} maxLength={KNOWLEDGE_LIMITS.topicMaxLength} />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">{label("title")}</span>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} maxLength={KNOWLEDGE_LIMITS.titleMaxLength} />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-foreground">{label("body")}</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={kind === "note" ? 10 : 4}
            maxLength={KNOWLEDGE_LIMITS.bodyMaxLength}
            className={TEXTAREA}
          />
        </label>

        {(kind === "example" || kind === "qa") && (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">{label("answer")}</span>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={6} maxLength={KNOWLEDGE_LIMITS.answerMaxLength} className={TEXTAREA} />
            <span className="block text-xs text-muted">{t("knowledge.answerHidden")}</span>
          </label>
        )}

        {kind === "vocab" && (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-foreground">{t("knowledge.examples")}</span>
            <textarea value={examples} onChange={(e) => setExamples(e.target.value)} rows={4} className={TEXTAREA} placeholder={t("knowledge.examplesPlaceholder")} />
          </label>
        )}
      </Card>

      <Card className="space-y-3">
        <ErrorText>{error}</ErrorText>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={saving}>
            {t("planner.save")}
          </Button>
          <Button variant="secondary" onClick={() => back(item?.id)}>
            {t("planner.cancel")}
          </Button>
          {item && !confirmDelete && (
            <Button variant="dangerGhost" className="ml-auto" onClick={() => setConfirmDelete(true)}>
              {t("knowledge.delete")}
            </Button>
          )}
        </div>
        {item && confirmDelete && (
          <div role="alertdialog" className="space-y-2 rounded-control border border-danger p-3">
            <p className="text-sm text-foreground">{t("knowledge.deleteConfirm", { title: item.title })}</p>
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
    </form>
  );
}
