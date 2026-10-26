"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { dictationRoutes } from "@/components/dictation/routes";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { COLOR_HEX, subjectName } from "@/components/planner/plannerUi";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorText, TextInput } from "@/components/ui/TextInput";
import { errorMessage, type MessageKey } from "@/lib/i18n";
import { vocabItemsText, vocabLanguage } from "@/lib/knowledge/KnowledgeService";
import type { SubjectView } from "@/lib/planner/plannerRules";
import type { StudentSummary } from "@/lib/student/StudentService";
import { KNOWLEDGE_KINDS, type KnowledgeItem, type KnowledgeKind } from "@/types";
import { KIND_ICON, REVIEWABLE, knowledgeRoutes } from "./knowledgeUi";
import { ReviewDeck } from "./ReviewDeck";

/** 個人溫習知識庫: notes, worked examples, Q&A and vocabulary by subject; review mode; words → dictation list. */
export function KnowledgeLibrary({ student, focusId }: { student: StudentSummary; focusId: string | null }) {
  const { t, services, dataVersion } = useApp();
  const router = useRouter();
  const [items, setItems] = useState<KnowledgeItem[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectView[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [kind, setKind] = useState<KnowledgeKind | "">("");
  const [query, setQuery] = useState("");
  const [reviewing, setReviewing] = useState<KnowledgeItem[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [listTitle, setListTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reload = () => services.knowledge.list(student.id).then(setItems);

  useEffect(() => {
    services.knowledge.list(student.id).then(setItems);
    services.planner.options().then((o) => setSubjects(o.subjects));
  }, [services, student.id, dataVersion]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (items ?? []).filter(
      (i) =>
        (!subjectId || i.subjectId === subjectId) &&
        (!kind || i.kind === kind) &&
        (!q || [i.title, i.body, i.answer ?? "", i.topic ?? "", ...(i.examples ?? [])].some((s) => s.toLowerCase().includes(q))),
    );
  }, [items, subjectId, kind, query]);

  const reviewable = shown.filter((i) => REVIEWABLE.includes(i.kind));
  const vocab = shown.filter((i) => i.kind === "vocab");

  async function makeDictationList() {
    const chosen = (items ?? []).filter((i) => picked.includes(i.id));
    if (!chosen.length) return;
    const language = vocabLanguage(chosen);
    try {
      const list = await services.dictation.create(student.id, language, {
        type: "words",
        title: listTitle.trim() || chosen[0].topic || t("knowledge.defaultListTitle"),
        itemsText: vocabItemsText(chosen),
        paragraphs: [],
      });
      router.push(dictationRoutes.edit(language, list.id));
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  if (reviewing) {
    return (
      <ReviewDeck
        studentId={student.id}
        items={reviewing}
        onDone={() => {
          setReviewing(null);
          void reload();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <PageHeader title={t("nav.knowledge")}>{t("knowledge.intro")}</PageHeader>
        <Link
          href={knowledgeRoutes.create(kind || undefined)}
          className="inline-flex min-h-11 shrink-0 items-center rounded-control bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          {t("knowledge.add")}
        </Link>
      </div>

      {items && items.length > 0 && (
        <Card className="space-y-3">
          <TextInput type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("knowledge.search")} aria-label={t("knowledge.search")} />
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("knowledge.kind")}>
            {(["", ...KNOWLEDGE_KINDS] as const).map((k) => (
              <button
                key={k || "all"}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`min-h-9 rounded-full border px-3 text-sm ${kind === k ? "border-primary bg-primary-soft font-medium text-foreground" : "border-border bg-surface text-muted"}`}
              >
                {k ? `${KIND_ICON[k]} ${t(`knowledge.kind.${k}` as MessageKey)}` : t("knowledge.allKinds")}
              </button>
            ))}
          </div>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            aria-label={t("planner.fieldSubject")}
            className="min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-foreground"
          >
            <option value="">{t("prompts.allSubjects")}</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {subjectName(t, s)}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button disabled={reviewable.length === 0} onClick={() => setReviewing(reviewable)}>
              {t("knowledge.review", { n: reviewable.length })}
            </Button>
            <Button
              variant="secondary"
              disabled={vocab.length === 0}
              aria-pressed={picking}
              onClick={() => {
                setPicking((p) => !p);
                setPicked([]);
                setError(null);
              }}
            >
              {t(picking ? "knowledge.pickCancel" : "knowledge.toDictation")}
            </Button>
          </div>
          {picking && (
            <div className="space-y-2 rounded-control bg-surface-muted p-3">
              <p className="text-sm text-foreground">{t("knowledge.pickHint", { n: picked.length })}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setPicked(vocab.map((v) => v.id))}>
                  {t("knowledge.pickAll")}
                </Button>
                <TextInput
                  value={listTitle}
                  onChange={(e) => setListTitle(e.target.value)}
                  placeholder={t("knowledge.listTitle")}
                  aria-label={t("knowledge.listTitle")}
                  className="flex-1"
                />
                <Button disabled={picked.length === 0} onClick={makeDictationList}>
                  {t("knowledge.makeList", { n: picked.length })}
                </Button>
              </div>
              <ErrorText>{error}</ErrorText>
            </div>
          )}
        </Card>
      )}

      {!items ? (
        <p className="text-sm text-muted">{t("app.loading")}</p>
      ) : items.length === 0 ? (
        <Card className="space-y-3">
          <p className="font-medium text-foreground">{t("knowledge.emptyTitle")}</p>
          <p className="text-sm text-muted">{t("knowledge.emptyHint")}</p>
          <div className="flex flex-wrap gap-2">
            {KNOWLEDGE_KINDS.map((k) => (
              <Link
                key={k}
                href={knowledgeRoutes.create(k)}
                className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-primary-soft"
              >
                {KIND_ICON[k]} {t(`knowledge.kind.${k}` as MessageKey)}
              </Link>
            ))}
          </div>
        </Card>
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted">{t("knowledge.noMatch")}</p>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              subjects={subjects}
              focused={item.id === focusId}
              picking={picking && item.kind === "vocab"}
              picked={picked.includes(item.id)}
              onPick={(on) => setPicked((p) => (on ? [...p, item.id] : p.filter((x) => x !== item.id)))}
              onPin={async () => {
                await services.knowledge.setPinned(student.id, item.id, !item.pinned);
                await reload();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemCard({
  item,
  subjects,
  focused,
  picking,
  picked,
  onPick,
  onPin,
}: {
  item: KnowledgeItem;
  subjects: SubjectView[];
  focused: boolean;
  picking: boolean;
  picked: boolean;
  onPick: (on: boolean) => void;
  onPin: () => void;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(focused);
  const [showAnswer, setShowAnswer] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const subject = subjects.find((s) => s.id === item.subjectId);

  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ block: "center" });
  }, [focused]);

  const hasAnswer = item.kind === "example" || item.kind === "qa";
  const tested = (item.known ?? 0) + (item.unknown ?? 0);

  return (
    <li ref={ref} className={`rounded-card border bg-surface shadow-card ${focused ? "border-primary border-2" : "border-border"}`}>
      <div className="flex">
        <span aria-hidden="true" className="w-1.5 shrink-0 rounded-l-card" style={{ backgroundColor: subject ? COLOR_HEX[subject.color] : "transparent" }} />
        <div className="min-w-0 flex-1 space-y-2 p-4">
          <div className="flex items-start gap-2">
            {picking && (
              <input
                type="checkbox"
                checked={picked}
                onChange={(e) => onPick(e.target.checked)}
                aria-label={t("knowledge.pickWord", { word: item.title })}
                className="mt-1 size-5 shrink-0 accent-[var(--sd-primary)]"
              />
            )}
            <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="min-w-0 flex-1 text-left">
              <span className="block font-semibold text-foreground">
                <span aria-hidden="true">{KIND_ICON[item.kind]} </span>
                {item.title}
              </span>
              <span className="block text-xs text-muted">
                {[t(`knowledge.kind.${item.kind}` as MessageKey), subject && subjectName(t, subject), item.topic].filter(Boolean).join(" · ")}
                {tested > 0 && ` · ${t("knowledge.score", { known: item.known ?? 0, total: tested })}`}
              </span>
            </button>
            <button
              type="button"
              onClick={onPin}
              aria-pressed={Boolean(item.pinned)}
              aria-label={t(item.pinned ? "knowledge.unpin" : "knowledge.pin")}
              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-lg ${item.pinned ? "" : "opacity-40 grayscale"}`}
            >
              ⭐
            </button>
          </div>

          {open && (
            <div className="space-y-2">
              {item.body && <p className="text-sm whitespace-pre-line text-foreground">{item.body}</p>}
              {item.kind === "vocab" && item.examples && (
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-foreground">
                  {item.examples.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              {hasAnswer &&
                (showAnswer ? (
                  <div className="rounded-control bg-surface-muted p-3">
                    <p className="mb-1 text-xs font-medium text-muted">{t("practice.answer")}</p>
                    <p className="text-sm whitespace-pre-line text-foreground">{item.answer}</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAnswer(true)}
                    className="min-h-11 rounded-control bg-reveal px-4 text-sm font-semibold text-on-reveal hover:bg-reveal-hover"
                  >
                    {t("knowledge.showAnswer")}
                  </button>
                ))}
              <Link href={knowledgeRoutes.edit(item.id)} className="inline-block text-sm font-medium text-primary hover:underline">
                {t("prompts.edit")}
              </Link>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
