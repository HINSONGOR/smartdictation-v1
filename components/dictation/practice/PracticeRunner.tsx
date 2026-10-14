"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { StrokeAnimation } from "@/components/stroke/StrokeAnimation";
import { ThemeMascot } from "@/components/theme/Mascot";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckIcon, CrossIcon, SpeakerIcon } from "@/components/ui/icons";
import { TextInput } from "@/components/ui/TextInput";
import {
  answerFor,
  currentAnswer,
  currentItem,
  groupItems,
  groupRange,
  isGroupEnd,
  itemAfterGroup,
  type PracticeAction,
  type PracticeState,
} from "@/lib/dictation/practiceSession";
import { diffAnswer } from "@/lib/dictation/answerDiff";
import type { MessageKey } from "@/lib/i18n";
import { RedPenLine } from "./RedPen";
import type { ChineseVoice, PracticeItem, PracticeSpeed } from "@/types";

const SPEECH_RATE: Record<PracticeSpeed, number> = { slow: 0.6, normal: 0.9 };
/** "🐢 慢些讀" plays at this fraction of the current speed. */
const SLOWER_FACTOR = 0.65;
/** Pause between repeats when "🔁 重複聆聽" is on. */
const REPEAT_GAP_MS = 2500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface Props {
  state: PracticeState;
  speed: PracticeSpeed;
  onAction: (action: PracticeAction) => void;
}

/** One running practice session: listen → answer (typed) or reveal + self-mark (paper) → next. */
export function PracticeRunner({ state, speed, onAction }: Props) {
  const { t, services } = useApp();
  const { tts } = services;
  const { language } = state;
  const item = currentItem(state);
  const rate = SPEECH_RATE[speed];

  const [voice, setVoice] = useState<ChineseVoice>("cantonese");
  const [repeat, setRepeat] = useState(false);
  const repeatRef = useRef(false);
  const loopId = useRef(0);

  /** Read the text; keeps repeating while "repeat" is on. A newer call cancels older loops. */
  const play = useCallback(
    async (text: string) => {
      const id = ++loopId.current;
      while (loopId.current === id) {
        await tts.speak(text, language, { rate, voice }).catch(() => undefined);
        if (!repeatRef.current || loopId.current !== id) return;
        await sleep(REPEAT_GAP_MS);
      }
    },
    [tts, language, rate, voice],
  );

  /** Stop any running repeat loop (bumping the id makes every older loop exit). */
  const cancelLoop = useCallback(() => {
    loopId.current++;
  }, []);

  // Read each new item automatically (and again when the voice changes).
  useEffect(() => {
    if (state.phase !== "question") return;
    play(item.text);
    return cancelLoop;
  }, [state.phase, item, play, cancelLoop]);

  useEffect(() => () => tts.stop(), [tts]);

  function toggleRepeat() {
    const on = !repeat;
    setRepeat(on);
    repeatRef.current = on;
    if (on) play(item.text);
    else {
      cancelLoop();
      tts.stop();
    }
  }

  function playSlower() {
    cancelLoop();
    tts.speak(item.text, language, { rate: rate * SLOWER_FACTOR, voice }).catch(() => undefined);
  }

  const total = state.items.length;
  const answered = state.phase === "question" ? state.index : state.index + 1;
  const answer = currentAnswer(state);
  const group = groupItems(state);
  const [groupStart] = groupRange(state);
  const isParagraph = group.length > 1;
  const atGroupEnd = isGroupEnd(state);
  const nextItem = itemAfterGroup(state);
  const nextLabel: MessageKey = !nextItem
    ? "practice.complete"
    : nextItem.kind === "sentence"
      ? "practice.nextSentence"
      : "practice.nextWord";

  return (
    <Card className="mx-auto max-w-2xl space-y-5">
      {/* Progress */}
      <div>
        <div className="mb-1 flex items-center justify-between gap-2 text-sm text-muted">
          <span>{t("practice.progress", { current: state.index + 1, total })}</span>
          <KindBadge item={item} position={isParagraph ? { k: state.index - groupStart + 1, n: group.length } : undefined} />
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </div>

      {/* Chinese voice */}
      {language === "zh" && (
        <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label={t("practice.voice")}>
          {(["cantonese", "mandarin"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={voice === v}
              onClick={() => setVoice(v)}
              className={`min-h-11 rounded-control border px-4 text-sm font-medium ${
                voice === v ? "border-primary bg-primary-soft text-foreground" : "border-border bg-surface text-muted"
              }`}
            >
              {voice === v && "🔴 "}
              {t(`practice.voice.${v}`)}
            </button>
          ))}
        </div>
      )}

      {/* Listening controls */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => play(item.text)}
          className="flex size-24 flex-col items-center justify-center gap-1 rounded-full bg-primary text-on-primary shadow-card transition hover:bg-primary-hover active:scale-95"
        >
          <SpeakerIcon className="size-9" />
          <span className="text-xs">{t("practice.replay")}</span>
        </button>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant={repeat ? "primary" : "secondary"} aria-pressed={repeat} onClick={toggleRepeat}>
            {t(repeat ? "practice.repeatOn" : "practice.repeat")}
          </Button>
          <Button variant="secondary" onClick={playSlower}>
            {t("practice.slower")}
          </Button>
        </div>
      </div>

      {state.phase === "question" && <HintReveal key={`hint-${item.id}`} hint={item.hint} />}

      {/* Paper mode: write; inside a paragraph go sentence by sentence, reveal after the last one */}
      {state.phase === "question" && state.mode === "paper" && (
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted">
            {t(!isParagraph ? "practice.paperHint" : atGroupEnd ? "practice.paperParagraphEndHint" : "practice.paperSentenceHint")}
          </p>
          <div className="flex gap-2">
            {isParagraph && state.index > groupStart && (
              <Button variant="secondary" className="min-h-12" onClick={() => onAction({ type: "previous" })}>
                {t("practice.previousSentence")}
              </Button>
            )}
            {atGroupEnd ? (
              <button
                type="button"
                onClick={() => onAction({ type: "reveal" })}
                className="min-h-12 flex-1 rounded-control bg-reveal px-4 text-base font-semibold text-on-reveal shadow-card transition hover:bg-reveal-hover"
              >
                {t(isParagraph ? "practice.revealParagraph" : "practice.reveal")}
              </button>
            ) : (
              <Button className="min-h-12 flex-1 text-base" onClick={() => onAction({ type: "next" })}>
                {t("practice.nextSentence")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Typing mode: type, then check */}
      {state.phase === "question" && state.mode === "typing" && !isParagraph && (
        <TypingQuestion key={`answer-${item.id}`} item={item} language={language} onAction={onAction} />
      )}

      {/* Typing mode, paragraph: one box per sentence heard so far; check the whole paragraph at the end */}
      {state.phase === "question" && state.mode === "typing" && isParagraph && (
        <TypingParagraph
          key={`paragraph-${group[0].id}`}
          items={group}
          current={state.index - groupStart}
          language={language}
          onAction={onAction}
        />
      )}

      {/* Typing mode, paragraph: every sentence marked with the red pen */}
      {state.phase === "feedback" && isParagraph && (
        <TypingParagraphResult state={state} items={group} language={language} nextLabel={nextLabel} onAction={onAction} />
      )}

      {/* Paper mode, paragraph: whole paragraph answer, each sentence marked separately */}
      {state.phase === "revealed" && isParagraph && (
        <ParagraphAnswer
          state={state}
          items={group}
          language={language}
          nextLabel={nextLabel}
          onAction={onAction}
        />
      )}

      {/* Paper mode, single item: answer + strokes + self-assessment */}
      {state.phase === "revealed" && !isParagraph && (
        <div className="space-y-4">
          <AnswerPanel item={item} language={language} />
          <div className="space-y-2">
            <p className="text-center text-sm font-medium text-foreground">{t("practice.selfAssess")}</p>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("practice.selfAssess")}>
              <SelfMarkButton
                active={answer?.correct === true}
                tone="success"
                label={t("practice.selfCorrect")}
                onClick={() => onAction({ type: "selfMark", correct: true })}
              />
              <SelfMarkButton
                active={answer?.correct === false}
                tone="danger"
                label={t("practice.selfWrong")}
                onClick={() => onAction({ type: "selfMark", correct: false })}
              />
            </div>
          </div>
          <Button className="w-full text-base" disabled={!answer} onClick={() => onAction({ type: "next" })}>
            {t(nextLabel)}
          </Button>
        </div>
      )}

      {/* Typing mode: automatic result */}
      {state.phase === "feedback" && !isParagraph && answer && (
        <div
          role="status"
          className={`space-y-3 rounded-control border-2 p-4 ${answer.correct ? "border-success" : "border-danger"}`}
        >
          <div className="flex items-center gap-3">
            <div className={answer.correct ? "motion-safe:animate-pop" : "motion-safe:animate-shake"}>
              <ThemeMascot size={56} className="size-14" />
            </div>
            <p className={`flex items-center gap-1 text-xl font-bold ${answer.correct ? "text-success" : "text-danger"}`}>
              {answer.correct ? <CheckIcon className="size-6" /> : <CrossIcon className="size-6" />}
              {t(answer.correct ? "practice.correct" : "practice.wrong")}
            </p>
          </div>
          {answer.correct ? (
            <AnswerPanel item={item} language={language} />
          ) : (
            <MarkedAnswer item={item} typed={answer.answer ?? ""} language={language} large={item.kind === "word"} />
          )}
          <Button autoFocus className="w-full text-base" onClick={() => onAction({ type: "next" })}>
            {t(nextLabel)}
          </Button>
        </div>
      )}
    </Card>
  );
}

function KindBadge({ item, position }: { item: PracticeItem; position?: { k: number; n: number } }) {
  const { t } = useApp();
  const label =
    item.kind === "word"
      ? t("practice.kind.word")
      : item.paragraphNumber
        ? t("practice.kind.sentence", { n: item.paragraphNumber })
        : t("practice.kind.sentenceReview");
  return (
    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
      {label}
      {position && ` · ${t("practice.sentencePos", position)}`}
    </span>
  );
}

/** Whole paragraph revealed after its last sentence; every sentence gets its own ✓ / ✗. */
function ParagraphAnswer({
  state,
  items,
  language,
  nextLabel,
  onAction,
}: {
  state: PracticeState;
  items: PracticeItem[];
  language: PracticeState["language"];
  nextLabel: MessageKey;
  onAction: (action: PracticeAction) => void;
}) {
  const { t } = useApp();
  const [strokesFor, setStrokesFor] = useState<string | null>(null);
  const allMarked = items.every((i) => answerFor(state, i.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {t("practice.paragraphAnswer", { n: items[0].paragraphNumber ?? 1 })} · {t("practice.markEachSentence")}
        </p>
        <Button
          variant="secondary"
          className="min-h-10 px-3"
          onClick={() => onAction({ type: "selfMarkAll", correct: true })}
        >
          {t("practice.allCorrect")}
        </Button>
      </div>

      <ol className="space-y-2">
        {items.map((sentence) => {
          const mark = answerFor(state, sentence.id);
          return (
            <li key={sentence.id} className="space-y-2 rounded-control bg-surface-muted p-3">
              <p className="text-xl leading-relaxed text-foreground">{sentence.text}</p>
              <div className="flex flex-wrap items-center gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2" role="radiogroup" aria-label={sentence.text}>
                  <SelfMarkButton
                    active={mark?.correct === true}
                    tone="success"
                    label={t("practice.selfCorrect")}
                    onClick={() => onAction({ type: "selfMark", itemId: sentence.id, correct: true })}
                  />
                  <SelfMarkButton
                    active={mark?.correct === false}
                    tone="danger"
                    label={t("practice.selfWrong")}
                    onClick={() => onAction({ type: "selfMark", itemId: sentence.id, correct: false })}
                  />
                </div>
                {language === "zh" && (
                  <Button
                    variant="ghost"
                    className="min-h-12 px-3"
                    aria-expanded={strokesFor === sentence.id}
                    onClick={() => setStrokesFor((cur) => (cur === sentence.id ? null : sentence.id))}
                  >
                    {t(strokesFor === sentence.id ? "practice.hideStrokes" : "practice.strokes")}
                  </Button>
                )}
              </div>
              {strokesFor === sentence.id && <StrokeAnimation text={sentence.text} hint={t("practice.strokeHint")} />}
            </li>
          );
        })}
      </ol>

      <Button className="w-full text-base" disabled={!allMarked} onClick={() => onAction({ type: "next" })}>
        {t(nextLabel)}
      </Button>
    </div>
  );
}

/** The correct answer, with stroke animation for Chinese. */
function AnswerPanel({ item, language }: { item: PracticeItem; language: PracticeState["language"] }) {
  const { t } = useApp();
  return (
    <div className="space-y-2 rounded-control bg-surface-muted p-3">
      <p className="text-xs font-medium text-muted">{t("practice.answer")}</p>
      {language === "zh" ? (
        <StrokeAnimation key={item.id} text={item.text} hint={t("practice.strokeHint")} />
      ) : (
        <p className={`text-center font-semibold text-foreground ${item.kind === "word" ? "text-3xl" : "text-xl"}`}>
          {item.text}
        </p>
      )}
      {item.hint && <p className="text-center text-sm text-muted">{t("practice.hint", { hint: item.hint })}</p>}
    </div>
  );
}

function HintReveal({ hint }: { hint?: string }) {
  const { t } = useApp();
  const [shown, setShown] = useState(false);
  if (!hint) return null;
  return shown ? (
    <p className="text-center text-sm text-muted">{t("practice.hint", { hint })}</p>
  ) : (
    <div className="text-center">
      <Button variant="ghost" onClick={() => setShown(true)}>
        {t("practice.showHint")}
      </Button>
    </div>
  );
}

/** Wrong typed answer: the student's line and the correct line, marked with the red pen. */
function MarkedAnswer({
  item,
  typed,
  language,
  large = false,
  strokes = true,
}: {
  item: PracticeItem;
  typed: string;
  language: PracticeState["language"];
  large?: boolean;
  /** Chinese: play the stroke animation of the correct answer. */
  strokes?: boolean;
}) {
  const { t } = useApp();
  const diff = diffAnswer(typed, item.text, language);
  const size = large ? "text-3xl" : "text-xl";
  return (
    <div className="space-y-2 rounded-control bg-surface-muted p-3">
      <div>
        <p className="text-xs font-medium text-muted">{t("practice.youWrote")}</p>
        <p className={`leading-relaxed text-foreground ${size}`}>
          <RedPenLine tokens={diff.answer} variant="answer" />
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted">{t("practice.correctAnswer")}</p>
        <p className={`font-semibold leading-relaxed text-foreground ${size}`}>
          <RedPenLine tokens={diff.expected} variant="expected" />
        </p>
      </div>
      {language === "zh" && strokes && <StrokeAnimation key={item.id} text={item.text} hint={t("practice.strokeHint")} />}
      {item.hint && <p className="text-sm text-muted">{t("practice.hint", { hint: item.hint })}</p>}
      <p className="text-xs text-muted">{t("practice.redPenNote")}</p>
    </div>
  );
}

/** Typing a paragraph: listen sentence by sentence, one box per sentence heard so far, check at the end. */
function TypingParagraph({
  items,
  current,
  language,
  onAction,
}: {
  items: PracticeItem[];
  /** Position of the sentence being read (0-based within the paragraph). */
  current: number;
  language: PracticeState["language"];
  onAction: (action: PracticeAction) => void;
}) {
  const { t } = useApp();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const currentRef = useRef<HTMLInputElement>(null);
  const atEnd = current === items.length - 1;

  useEffect(() => {
    currentRef.current?.focus();
  }, [current]);

  function forward(event?: FormEvent) {
    event?.preventDefault();
    onAction(atEnd ? { type: "submitGroup", answers: drafts } : { type: "next" });
  }

  return (
    <form onSubmit={forward} className="space-y-3">
      <p className="text-center text-sm text-muted">{t(atEnd ? "practice.typeParagraphEndHint" : "practice.typeSentenceHint")}</p>
      <ol className="space-y-2">
        {items.slice(0, current + 1).map((sentence, k) => (
          <li key={sentence.id}>
            <label className="block space-y-1">
              <span className="text-xs text-muted">{t("practice.sentenceN", { n: k + 1 })}</span>
              <TextInput
                ref={k === current ? currentRef : undefined}
                value={drafts[sentence.id] ?? ""}
                onChange={(e) => setDrafts((d) => ({ ...d, [sentence.id]: e.target.value }))}
                placeholder={k === current ? t("practice.answerPlaceholder") : undefined}
                lang={language === "zh" ? "zh-HK" : "en"}
                // Autocorrect / auto-capitalise would change the answer (case and spelling are checked).
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                enterKeyHint={atEnd && k === current ? "done" : "next"}
                className={`text-lg ${k === current ? "border-primary" : ""}`}
              />
            </label>
          </li>
        ))}
      </ol>
      <div className="flex gap-2">
        {current > 0 && (
          <Button variant="secondary" className="min-h-12" onClick={() => onAction({ type: "previous" })}>
            {t("practice.previousSentence")}
          </Button>
        )}
        <Button type="submit" className="min-h-12 flex-1 text-base">
          {t(atEnd ? "practice.checkParagraph" : "practice.nextSentence")}
        </Button>
      </div>
    </form>
  );
}

/** Typing a paragraph: result for every sentence, wrong ones marked with the red pen. */
function TypingParagraphResult({
  state,
  items,
  language,
  nextLabel,
  onAction,
}: {
  state: PracticeState;
  items: PracticeItem[];
  language: PracticeState["language"];
  nextLabel: MessageKey;
  onAction: (action: PracticeAction) => void;
}) {
  const { t } = useApp();
  const [strokesFor, setStrokesFor] = useState<string | null>(null);
  const results = items.map((sentence) => ({ sentence, answer: answerFor(state, sentence.id) }));
  const correct = results.filter((r) => r.answer?.correct).length;
  const allCorrect = correct === items.length;

  return (
    <div role="status" className={`space-y-3 rounded-control border-2 p-4 ${allCorrect ? "border-success" : "border-danger"}`}>
      <div className="flex items-center gap-3">
        <div className={allCorrect ? "motion-safe:animate-pop" : "motion-safe:animate-shake"}>
          <ThemeMascot size={56} className="size-14" />
        </div>
        <p className={`text-lg font-bold ${allCorrect ? "text-success" : "text-danger"}`}>
          {t("practice.paragraphScore", { n: items[0].paragraphNumber ?? 1, correct, total: items.length })}
        </p>
      </div>
      <ol className="space-y-2">
        {results.map(({ sentence, answer }, k) => (
          <li key={sentence.id} className="space-y-2">
            <p className={`flex items-center gap-1 text-sm font-semibold ${answer?.correct ? "text-success" : "text-danger"}`}>
              {answer?.correct ? <CheckIcon className="size-4" /> : <CrossIcon className="size-4" />}
              {t("practice.sentenceN", { n: k + 1 })}
            </p>
            {answer?.correct ? (
              <p className="rounded-control bg-surface-muted p-3 text-xl leading-relaxed text-foreground">{sentence.text}</p>
            ) : (
              <MarkedAnswer item={sentence} typed={answer?.answer ?? ""} language={language} strokes={strokesFor === sentence.id} />
            )}
            {language === "zh" && !answer?.correct && (
              <Button
                variant="ghost"
                className="min-h-10 px-3"
                aria-expanded={strokesFor === sentence.id}
                onClick={() => setStrokesFor((cur) => (cur === sentence.id ? null : sentence.id))}
              >
                {t(strokesFor === sentence.id ? "practice.hideStrokes" : "practice.strokes")}
              </Button>
            )}
          </li>
        ))}
      </ol>
      <Button autoFocus className="w-full text-base" onClick={() => onAction({ type: "next" })}>
        {t(nextLabel)}
      </Button>
    </div>
  );
}

function TypingQuestion({
  item,
  language,
  onAction,
}: {
  item: PracticeItem;
  language: PracticeState["language"];
  onAction: (action: PracticeAction) => void;
}) {
  const { t } = useApp();
  const [answer, setAnswer] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (answer.trim()) onAction({ type: "submit", answer });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="practice-answer" className="sr-only">
        {t("practice.answerLabel")}
      </label>
      <TextInput
        id="practice-answer"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={t("practice.answerPlaceholder")}
        lang={language === "zh" ? "zh-HK" : "en"}
        // Autocorrect / auto-capitalise would change the answer (case and spelling are checked).
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        autoFocus
        className={`text-center ${item.kind === "word" ? "text-2xl" : "text-lg"}`}
      />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => onAction({ type: "submit", answer: "" })}>
          {t("practice.skip")}
        </Button>
        <Button type="submit" className="flex-1 text-base" disabled={!answer.trim()}>
          {t("practice.submit")}
        </Button>
      </div>
    </form>
  );
}

function SelfMarkButton({
  active,
  tone,
  label,
  onClick,
}: {
  active: boolean;
  tone: "success" | "danger";
  label: string;
  onClick: () => void;
}) {
  const activeClass = tone === "success" ? "border-success bg-success text-on-primary" : "border-danger bg-danger text-on-primary";
  const idleClass = tone === "success" ? "border-success text-success" : "border-danger text-danger";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`min-h-12 rounded-control border-2 bg-surface px-3 text-base font-semibold transition ${active ? activeClass : idleClass}`}
    >
      {label}
    </button>
  );
}
