"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { subjectName } from "@/components/planner/plannerUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorText, TextInput } from "@/components/ui/TextInput";
import { createTranslator, errorMessage } from "@/lib/i18n";
import { photoFromFile } from "@/lib/ocr/photo";
import type { SubjectView } from "@/lib/planner/plannerRules";
import { parseQaResult, type ScannedQa } from "@/lib/scan/qaScan";
import { KNOWLEDGE_LIMITS } from "@/types";

const ZH = createTranslator("zh-HK");
const EN = createTranslator("en");
const subjectNames = (s: SubjectView) => (s.builtIn ? [subjectName(ZH, s), subjectName(EN, s)] : [s.name ?? ""]);

const TEXTAREA =
  "w-full rounded-control border border-border bg-surface p-3 text-base leading-7 text-foreground focus:outline-2 focus:outline-primary";

/** 📷 Q&A worksheet → editable question / answer list → Q&A cards in the knowledge base. Photos are not stored. */
export function QaScanPanel({ studentId, subjects, onDone }: { studentId: string; subjects: SubjectView[]; onDone: (added: number) => void }) {
  const { t, services, settings } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [items, setItems] = useState<ScannedQa[]>([]);
  const [topic, setTopic] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function pick() {
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
    if (!file) return;
    setReading(true);
    setError(null);
    try {
      const answer = await services.ocr.readQa(await photoFromFile(file), settings.locale === "en" ? "en" : "zh");
      const result = parseQaResult(answer, subjects, subjectNames);
      if (!result) throw new Error("unreadable");
      if (result.items.length === 0) setError(t("knowledge.scanNothing"));
      setItems((prev) => [...prev, ...result.items]);
      if (!topic && result.topic) setTopic(result.topic);
      if (!subjectId && result.subjectId) setSubjectId(result.subjectId);
    } catch (err) {
      setError(err instanceof Error && err.message === "unreadable" ? t("error.cloud.ocrFailed") : errorMessage(t, err));
    } finally {
      setReading(false);
    }
  }

  const update = (key: string, patch: Partial<ScannedQa>) => setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const chosen = items.filter((i) => i.include);
  const missingAnswer = chosen.some((i) => !i.answer.trim());

  async function addAll() {
    setSaving(true);
    setError(null);
    try {
      await services.knowledge.createMany(
        studentId,
        chosen.map((i) => ({ kind: "qa" as const, title: i.question, body: "", answer: i.answer, topic, subjectId: subjectId || undefined })),
      );
      onDone(chosen.length);
    } catch (err) {
      setError(errorMessage(t, err));
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t("knowledge.scanTitle")}>{t("knowledge.scanIntro")}</PageHeader>
        <Button variant="ghost" onClick={() => onDone(0)}>
          {t("planner.cancel")}
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={read} />

      <Card className="space-y-3 text-center">
        <Button className="min-h-12 text-base" disabled={reading} onClick={pick}>
          {reading ? t("scan.reading") : items.length ? t("scan.addPhoto") : t("scan.pick")}
        </Button>
        <p className="text-xs text-muted">{t("knowledge.scanTip")}</p>
        <ErrorText>{error}</ErrorText>
      </Card>

      {items.length > 0 && (
        <>
          <Card className="grid grid-cols-2 gap-3">
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
              <TextInput value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={KNOWLEDGE_LIMITS.topicMaxLength} />
            </label>
          </Card>

          <p className="text-sm text-muted">{t("knowledge.scanCheck")}</p>
          <ol className="space-y-3">
            {items.map((item, n) => (
              <li key={item.key} className={`space-y-2 rounded-card border bg-surface p-4 shadow-card ${item.include ? "border-border" : "border-dashed border-border opacity-60"}`}>
                <label className="flex min-h-10 items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={item.include}
                    onChange={(e) => update(item.key, { include: e.target.checked })}
                    className="size-5 accent-[var(--sd-primary)]"
                  />
                  {t("knowledge.scanQuestionN", { n: n + 1 })}
                </label>
                {item.include && (
                  <>
                    <textarea
                      value={item.question}
                      onChange={(e) => update(item.key, { question: e.target.value })}
                      rows={2}
                      aria-label={t("knowledge.field.qa.title")}
                      maxLength={KNOWLEDGE_LIMITS.titleMaxLength}
                      className={TEXTAREA}
                    />
                    <label className="block space-y-1">
                      <span className={`text-xs ${item.answer.trim() ? "text-muted" : "font-semibold text-danger"}`}>
                        {item.answer.trim() ? t("knowledge.field.qa.answer") : t("knowledge.scanNoAnswer")}
                      </span>
                      <textarea value={item.answer} onChange={(e) => update(item.key, { answer: e.target.value })} rows={4} className={TEXTAREA} />
                    </label>
                  </>
                )}
              </li>
            ))}
          </ol>

          <Card className="space-y-2">
            {missingAnswer && <p className="text-sm text-danger">{t("knowledge.scanFillAnswers")}</p>}
            <Button disabled={saving || chosen.length === 0 || missingAnswer} onClick={addAll}>
              {t("knowledge.scanAddAll", { n: chosen.length })}
            </Button>
          </Card>
        </>
      )}
    </div>
  );
}
