"use client";

import { useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { ThemeMascot } from "@/components/theme/Mascot";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { KnowledgeItem } from "@/types";
import { KIND_ICON } from "./knowledgeUi";

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Flashcards for 問答 / 生字: question → show answer → 識 / 唔識; then again with the ones not known. */
export function ReviewDeck({ studentId, items, onDone }: { studentId: string; items: KnowledgeItem[]; onDone: () => void }) {
  const { t, services } = useApp();
  const [deck, setDeck] = useState(() => shuffle(items));
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [unknown, setUnknown] = useState<KnowledgeItem[]>([]);
  const [knownCount, setKnownCount] = useState(0);

  const card = deck[index];

  async function mark(knew: boolean) {
    await services.knowledge.recordReview(studentId, card.id, knew);
    if (knew) setKnownCount((n) => n + 1);
    else setUnknown((u) => [...u, card]);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  function restart(cards: KnowledgeItem[]) {
    setDeck(shuffle(cards));
    setIndex(0);
    setUnknown([]);
    setKnownCount(0);
    setRevealed(false);
  }

  if (!card) {
    const allKnown = unknown.length === 0;
    return (
      <div className="space-y-4">
        <PageHeader title={t("knowledge.reviewTitle")} />
        <Card className="space-y-3 text-center">
          <div className={allKnown ? "motion-safe:animate-pop" : ""}>
            <ThemeMascot size={72} className="mx-auto size-18" />
          </div>
          <p className="text-2xl font-bold text-foreground">
            {knownCount} / {deck.length}
          </p>
          <p className="text-sm text-muted">{t(allKnown ? "knowledge.reviewAllKnown" : "knowledge.reviewSome", { n: unknown.length })}</p>
          <div className="flex flex-wrap justify-center gap-2">
            {!allKnown && <Button onClick={() => restart(unknown)}>{t("knowledge.reviewAgainUnknown", { n: unknown.length })}</Button>}
            <Button variant="secondary" onClick={() => restart(items)}>
              {t("knowledge.reviewAgainAll")}
            </Button>
            <Button variant="ghost" onClick={onDone}>
              {t("knowledge.reviewExit")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <PageHeader title={t("knowledge.reviewTitle")} />
        <Button variant="ghost" onClick={onDone}>
          {t("knowledge.reviewExit")}
        </Button>
      </div>
      <p className="text-sm text-muted">{t("practice.progress", { current: index + 1, total: deck.length })}</p>
      <Card className="mx-auto max-w-2xl space-y-4 text-center">
        <p className="text-xs text-muted">{card.topic}</p>
        <p className="text-2xl font-bold text-foreground">
          <span aria-hidden="true">{KIND_ICON[card.kind]} </span>
          {card.title}
        </p>
        {card.kind === "qa" && card.body && <p className="text-sm whitespace-pre-line text-muted">{card.body}</p>}

        {revealed ? (
          <div className="space-y-2 rounded-control bg-surface-muted p-3 text-left">
            {card.kind === "vocab" ? (
              <>
                {card.body && <p className="whitespace-pre-line text-foreground">{card.body}</p>}
                {card.examples?.map((e, i) => (
                  <p key={i} className="text-sm text-muted">
                    • {e}
                  </p>
                ))}
              </>
            ) : (
              <p className="whitespace-pre-line text-foreground">{card.answer}</p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="min-h-12 w-full rounded-control bg-reveal px-4 text-base font-semibold text-on-reveal hover:bg-reveal-hover"
          >
            {t("knowledge.showAnswer")}
          </button>
        )}

        {revealed && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => mark(true)}
              className="min-h-12 rounded-control border-2 border-success bg-surface text-base font-semibold text-success hover:bg-success hover:text-on-primary"
            >
              {t("knowledge.knew")}
            </button>
            <button
              type="button"
              onClick={() => mark(false)}
              className="min-h-12 rounded-control border-2 border-danger bg-surface text-base font-semibold text-danger hover:bg-danger hover:text-on-primary"
            >
              {t("knowledge.didntKnow")}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
