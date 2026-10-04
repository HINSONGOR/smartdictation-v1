"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { ErrorText, TextInput } from "@/components/ui/TextInput";
import { cleanParagraphs, formatItems, parseItems } from "@/lib/dictation/DictationService";
import { autoSplitParagraphs, splitSentences } from "@/lib/dictation/passage";
import { errorMessage } from "@/lib/i18n";
import {
  DICTATION_LIMITS,
  listTypeOf,
  type DictationLanguage,
  type DictationList,
  type DictationListType,
} from "@/types";
import { dictationRoutes } from "./routes";

interface Props {
  studentId: string;
  language: DictationLanguage;
  /** Present when editing an existing list. */
  list?: DictationList;
}

interface ParagraphDraft {
  /** React key only. */
  key: number;
  text: string;
}

let draftKey = 0;
const draft = (text: string): ParagraphDraft => ({ key: draftKey++, text });

const TEXTAREA =
  "w-full rounded-control border border-border bg-surface p-3 text-base leading-7 text-foreground placeholder:text-muted focus:outline-2 focus:outline-primary";

export function DictationEditor({ studentId, language, list }: Props) {
  const { t, services } = useApp();
  const router = useRouter();

  // Type is chosen once on create; when editing it is locked to the list's original type.
  const [createType, setCreateType] = useState<DictationListType>("words");
  const type = list ? listTypeOf(list) : createType;

  const [title, setTitle] = useState(list?.title ?? "");
  const [itemsText, setItemsText] = useState(list ? formatItems(list.items) : "");
  const [paragraphs, setParagraphs] = useState<ParagraphDraft[]>(() =>
    list?.paragraphs?.length ? list.paragraphs.map((p) => draft(p.text)) : [draft("")],
  );
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [splitCount, setSplitCount] = useState<number | null>(null);
  const [splitChecked, setSplitChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const words = useMemo(() => parseItems(itemsText), [itemsText]);
  const overLimit = words.length > DICTATION_LIMITS.maxItems;
  const needsSplitCheck = type === "mixed" && splitCount !== null && !splitChecked;
  const backHref = dictationRoutes.lists(language);
  const langAttr = language === "zh" ? "zh-HK" : "en";

  const clearError = () => setError(null);

  function updateParagraph(key: number, text: string) {
    setParagraphs((prev) => prev.map((p) => (p.key === key ? { ...p, text } : p)));
    clearError();
  }

  function removeParagraph(key: number) {
    setParagraphs((prev) => (prev.length === 1 ? [draft("")] : prev.filter((p) => p.key !== key)));
  }

  function runAutoSplit() {
    const parts = autoSplitParagraphs(pasteText, language);
    if (parts.length === 0) {
      setError(t("dictation.splitNothing"));
      return;
    }
    setParagraphs(parts.map(draft));
    setSplitCount(parts.length);
    setSplitChecked(false);
    setPasteOpen(false);
    setPasteText("");
    clearError();
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (needsSplitCheck) {
      setError(t("dictation.mustConfirmSplit"));
      return;
    }
    setSaving(true);
    try {
      const input = { type, title, itemsText, paragraphs: paragraphs.map((p) => p.text) };
      if (list) await services.dictation.update(studentId, list.id, input);
      else await services.dictation.create(studentId, language, input);
      router.push(backHref);
    } catch (err) {
      setError(errorMessage(t, err));
      setSaving(false);
    }
  }

  async function remove() {
    if (!list) return;
    try {
      await services.dictation.remove(studentId, list.id);
      router.push(backHref);
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  const previewParagraphs = type === "mixed" ? cleanParagraphs(paragraphs.map((p) => p.text)) : [];

  return (
    <form onSubmit={save} className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        <Card className="space-y-4">
          {list ? (
            <div>
              <p className="mb-1 text-sm font-medium text-foreground">{t("dictation.type")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-control border-2 border-primary bg-primary-soft px-3 py-2 text-sm font-medium text-foreground">
                  {t(`dictation.type.${type}`)}
                </span>
                <span className="text-xs text-muted">{t("dictation.typeLocked")}</span>
              </div>
            </div>
          ) : (
            <Segmented
              label={t("dictation.type")}
              value={createType}
              onChange={(v) => {
                setCreateType(v);
                clearError();
              }}
              options={[
                { value: "words", label: t("dictation.type.words"), description: t("dictation.type.words.desc") },
                { value: "mixed", label: t("dictation.type.mixed"), description: t("dictation.type.mixed.desc") },
              ]}
            />
          )}

          <div>
            <label htmlFor="list-title" className="mb-1 block text-sm font-medium text-foreground">
              {t("dictation.titleLabel")}
            </label>
            <TextInput
              id="list-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearError();
              }}
              placeholder={t(`dictation.titlePlaceholder.${language}`)}
              maxLength={DICTATION_LIMITS.titleMaxLength}
            />
          </div>

          <div>
            <label htmlFor="list-items" className="mb-1 block text-sm font-medium text-foreground">
              {t(type === "mixed" ? "dictation.wordsOptionalLabel" : "dictation.itemsLabel")}
            </label>
            <textarea
              id="list-items"
              value={itemsText}
              onChange={(e) => {
                setItemsText(e.target.value);
                clearError();
              }}
              placeholder={t(`dictation.itemsPlaceholder.${language}`)}
              rows={type === "mixed" ? 4 : 10}
              lang={langAttr}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={TEXTAREA}
            />
            <p className="mt-1 text-xs text-muted">
              {t("dictation.itemsHelp", { example: t(`dictation.itemsExample.${language}`) })}
            </p>
          </div>
        </Card>

        {type === "mixed" && (
          <Card className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">{t("dictation.paragraphsLabel")}</h2>
              <Button variant="secondary" onClick={() => setPasteOpen((open) => !open)}>
                {t("dictation.pastePassage")}
              </Button>
            </div>
            <p className="text-xs text-muted">{t(`dictation.paragraphHelp.${language}`)}</p>

            {pasteOpen && (
              <div className="space-y-2 rounded-control border border-border bg-surface-muted p-3">
                <p className="text-xs text-muted">{t("dictation.pasteHint")}</p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={t("dictation.pastePlaceholder")}
                  aria-label={t("dictation.pastePlaceholder")}
                  rows={8}
                  lang={langAttr}
                  className={TEXTAREA}
                />
                <div className="flex gap-2">
                  <Button onClick={runAutoSplit} disabled={!pasteText.trim()}>
                    {t("dictation.autoSplit")}
                  </Button>
                  <Button variant="secondary" onClick={() => setPasteOpen(false)}>
                    {t("dictation.cancel")}
                  </Button>
                </div>
              </div>
            )}

            {splitCount !== null && (
              <div
                role="status"
                className={`space-y-2 rounded-control border-2 p-3 ${splitChecked ? "border-success" : "border-reveal"}`}
              >
                <p className="text-sm text-foreground">{t("dictation.splitResult", { count: splitCount })}</p>
                <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={splitChecked}
                    onChange={(e) => {
                      setSplitChecked(e.target.checked);
                      clearError();
                    }}
                    className="size-5 accent-[var(--sd-primary)]"
                  />
                  {t("dictation.confirmSplit")}
                </label>
              </div>
            )}

            <ol className="space-y-3">
              {paragraphs.map((p, index) => (
                <li key={p.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{t("dictation.paragraphN", { n: index + 1 })}</span>
                    <Button variant="dangerGhost" className="min-h-9 px-2 text-xs" onClick={() => removeParagraph(p.key)}>
                      {t("dictation.removeParagraph")}
                    </Button>
                  </div>
                  <textarea
                    value={p.text}
                    onChange={(e) => updateParagraph(p.key, e.target.value)}
                    placeholder={t("dictation.paragraphPlaceholder")}
                    aria-label={t("dictation.paragraphN", { n: index + 1 })}
                    rows={Math.min(Math.max(p.text.split("\n").length + 1, 3), 12)}
                    lang={langAttr}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={DICTATION_LIMITS.paragraphMaxLength}
                    className={TEXTAREA}
                  />
                </li>
              ))}
            </ol>
            <Button
              variant="secondary"
              className="w-full"
              disabled={paragraphs.length >= DICTATION_LIMITS.maxParagraphs}
              onClick={() => setParagraphs((prev) => [...prev, draft("")])}
            >
              {t("dictation.addParagraph")}
            </Button>
          </Card>
        )}

        <Card className="space-y-3">
          <ErrorText>{error ?? (needsSplitCheck ? t("dictation.mustConfirmSplit") : null)}</ErrorText>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={saving || overLimit || needsSplitCheck}>
              {t("dictation.save")}
            </Button>
            <Button variant="secondary" onClick={() => router.push(backHref)}>
              {t("dictation.cancel")}
            </Button>
            {list && !confirmingDelete && (
              <Button variant="dangerGhost" className="ml-auto" onClick={() => setConfirmingDelete(true)}>
                {t("dictation.delete")}
              </Button>
            )}
          </div>

          {list && confirmingDelete && (
            <div role="alertdialog" className="space-y-2 rounded-control border border-danger p-3">
              <p className="text-sm text-foreground">{t("dictation.deleteConfirm", { title: list.title })}</p>
              <div className="flex gap-2">
                <Button variant="danger" onClick={remove}>
                  {t("dictation.deleteYes")}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                  {t("dictation.cancel")}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card className="h-fit space-y-4 lg:sticky lg:top-20">
        <div>
          <h2 className={`mb-2 text-sm font-medium ${overLimit ? "text-danger" : "text-foreground"}`}>
            {t("dictation.preview", { count: words.length, max: DICTATION_LIMITS.maxItems })}
          </h2>
          <ol className="flex flex-wrap gap-2">
            {words.map((item, index) => (
              <li key={item.text}>
                <button
                  type="button"
                  onClick={() => services.tts.speak(item.text, language).catch(() => {})}
                  className="rounded-lg border border-border bg-surface-muted px-2 py-1 text-left text-sm text-foreground hover:border-primary"
                >
                  <span className="mr-1 text-xs text-muted">{index + 1}.</span>
                  {item.text}
                  {item.hint && <span className="ml-1 text-xs text-muted">({item.hint})</span>}
                </button>
              </li>
            ))}
          </ol>
        </div>

        {type === "mixed" && (
          <div>
            <h2 className="mb-2 text-sm font-medium text-foreground">
              {t("dictation.paragraphCount", { count: previewParagraphs.length })}
            </h2>
            <ol className="space-y-2">
              {previewParagraphs.map((text, index) => {
                const sentences = splitSentences(text, language);
                return (
                  <li key={index} className="rounded-lg border border-border bg-surface-muted p-2 text-sm">
                    <p className="mb-1 text-xs text-muted">
                      {t("dictation.paragraphN", { n: index + 1 })} · {t("dictation.sentenceCount", { count: sentences.length })}
                    </p>
                    <ol className="space-y-0.5">
                      {sentences.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() => services.tts.speak(s, language).catch(() => {})}
                            className="text-left text-foreground hover:text-primary"
                          >
                            {s}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </Card>
    </form>
  );
}
