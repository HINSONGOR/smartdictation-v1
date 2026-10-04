"use client";

import { useEffect, useState } from "react";
import { prefetchStrokeData } from "@/lib/stroke/prefetch";
import { buildPracticeItems, type PracticeSource } from "@/lib/dictation/practiceItems";
import { practiceReducer, startPractice, summarize, type PracticeAction, type PracticeState } from "@/lib/dictation/practiceSession";
import type { FinishResult } from "@/lib/dictation/PracticeService";
import type { DictationLanguage, PracticeItem, PracticeOptions } from "@/types";
import { PracticeResults } from "./PracticeResults";
import { PracticeRunner } from "./PracticeRunner";
import { PracticeSetup } from "./PracticeSetup";

/** Whether a run covers the chosen content or only the previous run's wrong items. */
export type RunScope = "full" | "retry";

/** A word list / passage (options decide what to practise), or a fixed set of items (mistake review). */
export type PracticeContent = { kind: "source"; source: PracticeSource } | { kind: "items"; items: PracticeItem[] };

interface Props {
  title: string;
  language: DictationLanguage;
  content: PracticeContent;
  backHref: string;
  /** Persist a finished run (word list practice or mistake review). */
  onFinish: (session: PracticeState, scope: RunScope) => Promise<FinishResult>;
}

type SaveState = { status: "saving" } | { status: "saved"; newlyMastered: string[] } | { status: "failed" };

function itemsFor(content: PracticeContent, options: PracticeOptions, random?: () => number): PracticeItem[] {
  return content.kind === "items" ? content.items : buildPracticeItems(content.source, options, random);
}

/** setup → running (question / reveal / feedback) → results, with retry. */
export function PracticeFlow({ title, language, content, backHref, onFinish }: Props) {
  const [options, setOptions] = useState<PracticeOptions | null>(null);
  const [session, setSession] = useState<PracticeState | null>(null);
  const [scope, setScope] = useState<RunScope>("full");
  const [save, setSave] = useState<SaveState>({ status: "saving" });

  // Fetch stroke data for all characters up front, so answers still animate if the network drops.
  useEffect(() => {
    if (language !== "zh") return;
    const texts =
      content.kind === "items"
        ? content.items.map((i) => i.text)
        : [...content.source.words.map((w) => w.text), ...content.source.paragraphs.map((p) => p.text)];
    prefetchStrokeData(texts);
  }, [language, content]);

  function begin(opts: PracticeOptions, runItems: PracticeItem[], runScope: RunScope) {
    if (runItems.length === 0) return;
    setOptions(opts);
    setScope(runScope);
    setSave({ status: "saving" });
    setSession(startPractice(runItems, { language, mode: opts.mode, order: opts.order }));
  }

  function act(action: PracticeAction) {
    if (!session) return;
    const next = practiceReducer(session, action);
    setSession(next);
    if (session.phase !== "done" && next.phase === "done") {
      onFinish(next, scope)
        .then((result) => setSave({ status: "saved", newlyMastered: result.newlyMastered }))
        .catch(() => setSave({ status: "failed" }));
    }
  }

  if (!options || !session) {
    const source = content.kind === "source" ? content.source : null;
    return (
      <PracticeSetup
        title={title}
        wordCount={source ? source.words.length : 0}
        paragraphs={source ? source.paragraphs : []}
        // For "random X paragraphs" the shown total is an estimate (sentence counts differ per paragraph).
        countItems={(o) => itemsFor(content, o, () => 0).length}
        onStart={(opts) => begin(opts, itemsFor(content, opts), "full")}
      />
    );
  }

  if (session.phase === "done") {
    const summary = summarize(session);
    const wrongIds = new Set(summary.wrong.map((w) => w.itemId));
    return (
      <PracticeResults
        summary={summary}
        language={language}
        backHref={backHref}
        saveFailed={save.status === "failed"}
        newlyMastered={save.status === "saved" ? save.newlyMastered : []}
        onRetryWrong={() => begin(options, session.items.filter((i) => wrongIds.has(i.id)), "retry")}
        onRetryAll={() => begin(options, itemsFor(content, options), "full")}
      />
    );
  }

  return <PracticeRunner state={session} speed={options.speed} onAction={act} />;
}
