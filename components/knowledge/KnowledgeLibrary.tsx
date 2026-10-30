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
import { KNOWLEDGE_PACKS, type KnowledgePack } from "@/lib/knowledge/packs";
import type { SubjectView } from "@/lib/planner/plannerRules";
import type { StudentSummary } from "@/lib/student/StudentService";
import { KNOWLEDGE_KINDS, type DictationList, type KnowledgeItem, type KnowledgeKind } from "@/types";
import { KIND_ICON, REVIEWABLE, knowledgeRoutes } from "./knowledgeUi";
import { QaScanPanel } from "./QaScanPanel";
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
  const [scanning, setScanning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [listTitle, setListTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** Dictation word lists, so a word card can open the list it is in. */
  const [lists, setLists] = useState<DictationList[]>([]);
  /** A dictation list just made from a pack. */
  const [madeList, setMadeList] = useState<DictationList | null>(null);

  const reload = () => services.knowledge.list(student.id).then(setItems);
  const loadLists = () =>
    Promise.all([services.dictation.listForStudent(student.id, "zh"), services.dictation.listForStudent(student.id, "en")]).then(
      ([zh, en]) => setLists([...zh, ...en]),
    );

  useEffect(() => {
    services.knowledge.list(student.id).then(setItems);
    services.planner.options().then((o) => setSubjects(o.subjects));
    Promise.all([services.dictation.listForStudent(student.id, "zh"), services.dictation.listForStudent(student.id, "en")]).then(
      ([zh, en]) => setLists([...zh, ...en]),
    );
  }, [services, student.id, dataVersion]);

  /** The newest dictation list containing each word. */
  const listOfWord = useMemo(() => {
    const map = new Map<string, DictationList>();
    for (const list of lists) for (const item of list.items) if (!map.has(item.text)) map.set(item.text, list);
    return map;
  }, [lists]);

  async function addPack(pack: KnowledgePack) {
    setError(null);
    setMadeList(null);
    try {
      const added = await services.knowledge.addPack(student.id, pack.items);
      setNotice(t("knowledge.packAdded", { n: added }));
      if (pack.dictationTitle) {
        const words = pack.items.filter((i) => i.kind === "vocab");
        const language = vocabLanguage(words);
        const existing = lists.find((l) => l.language === language && l.title === pack.dictationTitle);
        setMadeList(
          existing ??
            (await services.dictation.create(student.id, language, {
              type: "words",
              title: pack.dictationTitle,
              itemsText: vocabItemsText(words),
              paragraphs: [],
            })),
        );
        await loadLists();
      }
      await reload();
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

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

  if (scanning) {
    return (
      <QaScanPanel
        studentId={student.id}
        subjects={subjects}
        onDone={(added) => {
          setScanning(false);
          setNotice(added ? t("knowledge.scanAdded", { n: added }) : null);
          if (added) setKind("qa");
          void reload();
        }}
      />
    );
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
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Link
            href={knowledgeRoutes.create(kind || undefined)}
            className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-3 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            {t("knowledge.add")}
          </Link>
          <Button variant="secondary" onClick={() => setScanning(true)}>
            {t("knowledge.scanButton")}
          </Button>
        </div>
      </div>

      {notice && (
        <p role="status" className="rounded-control bg-surface-muted p-2 text-sm text-success">
          {notice}
          {madeList && (
            <>
              {" "}
              {t("knowledge.packListMade", { title: madeList.title })}{" "}
              <Link href={dictationRoutes.practice(madeList.language, madeList.id)} className="font-semibold text-primary underline">
                {t("knowledge.goDictation", { title: madeList.title })}
              </Link>
            </>
          )}
        </p>
      )}

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
              list={item.kind === "vocab" ? listOfWord.get(item.title) : undefined}
              onPick={(on) => setPicked((p) => (on ? [...p, item.id] : p.filter((x) => x !== item.id)))}
              onPin={async () => {
                await services.knowledge.setPinned(student.id, item.id, !item.pinned);
                await reload();
              }}
              onDelete={async () => {
                await services.knowledge.remove(student.id, item.id);
                await reload();
              }}
            />
          ))}
        </ul>
      )}

      {items && (
        <details open={items.length === 0} className="rounded-control border border-border bg-surface p-3">
          <summary className="cursor-pointer text-sm font-semibold text-foreground">{t("knowledge.packs")}</summary>
          <ul className="mt-3 space-y-2">
            {KNOWLEDGE_PACKS.map((pack) => {
              const have = new Set(items.map((i) => i.title));
              const missing = pack.items.filter((i) => !have.has(i.title)).length;
              return (
                <li key={pack.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control bg-surface-muted p-3">
                  <span className="min-w-0 text-sm text-foreground">
                    {t(pack.titleKey)}
                    <span className="block text-xs text-muted">{t(`${pack.titleKey}.desc` as MessageKey, { n: pack.items.length })}</span>
                  </span>
                  <Button variant="secondary" disabled={missing === 0} onClick={() => addPack(pack)}>
                    {missing === 0 ? t("knowledge.packHave") : t("knowledge.packAdd")}
                  </Button>
                </li>
              );
            })}
          </ul>
        </details>
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
  list,
  onPick,
  onPin,
  onDelete,
}: {
  item: KnowledgeItem;
  subjects: SubjectView[];
  focused: boolean;
  picking: boolean;
  picked: boolean;
  /** Dictation list this word is in. */
  list?: DictationList;
  onPick: (on: boolean) => void;
  onPin: () => void;
  onDelete: () => void;
}) {
  const { t } = useApp();
  const [open, setOpen] = useState(focused);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
            <div className="flex shrink-0 items-center">
              <button
                type="button"
                onClick={onPin}
                aria-pressed={Boolean(item.pinned)}
                aria-label={t(item.pinned ? "knowledge.unpin" : "knowledge.pin")}
                className={`flex size-9 items-center justify-center rounded-full text-lg ${item.pinned ? "" : "opacity-40 grayscale"}`}
              >
                ⭐
              </button>
              <Link
                href={knowledgeRoutes.edit(item.id)}
                aria-label={t("knowledge.editItem", { title: item.title })}
                className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-primary"
              >
                ✎
              </Link>
              {confirmDelete ? (
                <button type="button" onClick={onDelete} className="min-h-9 rounded-full bg-danger px-3 text-xs font-semibold text-on-primary">
                  {t("knowledge.confirmDelete")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={t("knowledge.deleteItem", { title: item.title })}
                  className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-muted hover:text-danger"
                >
                  🗑
                </button>
              )}
            </div>
          </div>
          {confirmDelete && (
            <div className="flex items-center justify-end gap-2 text-xs text-muted">
              {t("knowledge.deleteHint")}
              <button type="button" onClick={() => setConfirmDelete(false)} className="font-medium text-primary">
                {t("planner.cancel")}
              </button>
            </div>
          )}

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
              {list && (
                <Link
                  href={dictationRoutes.practice(list.language, list.id)}
                  className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-3 text-sm font-medium text-primary hover:bg-primary-soft"
                >
                  {t("knowledge.goDictation", { title: list.title })}
                </Link>
              )}
              {hasAnswer &&
                (showAnswer ? (
                  <div className="rounded-control bg-surface-muted p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted">{t("practice.answer")}</p>
                      <button type="button" onClick={() => setShowAnswer(false)} className="text-xs font-medium text-primary">
                        {t("knowledge.hideAnswer")}
                      </button>
                    </div>
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
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
