"use client";

import Link from "next/link";
import { useApp } from "@/components/layout/AppProvider";
import { ThemeMascot } from "@/components/theme/Mascot";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { PracticeSummary } from "@/lib/dictation/practiceSession";
import { joinList, type MessageKey } from "@/lib/i18n";
import type { DictationLanguage } from "@/types";

function resultMessage({ correct, total }: PracticeSummary): MessageKey {
  const ratio = total === 0 ? 0 : correct / total;
  if (ratio === 1) return "practice.result.perfect";
  if (ratio >= 0.8) return "practice.result.great";
  if (ratio >= 0.5) return "practice.result.good";
  return "practice.result.tryAgain";
}

interface Props {
  summary: PracticeSummary;
  language: DictationLanguage;
  backHref: string;
  saveFailed: boolean;
  /** Words that reached mastery in this run. */
  newlyMastered: string[];
  onRetryWrong: () => void;
  onRetryAll: () => void;
}

export function PracticeResults({
  summary,
  language,
  backHref,
  saveFailed,
  newlyMastered,
  onRetryWrong,
  onRetryAll,
}: Props) {
  const { t, services, settings } = useApp();

  return (
    <Card className="mx-auto max-w-xl space-y-5 text-center">
      <div className="flex flex-col items-center gap-2">
        <div className="motion-safe:animate-pop">
          <ThemeMascot size={96} className="size-24" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t("practice.resultTitle")}</h2>
        <p className="text-5xl font-bold text-primary">
          {summary.correct}
          <span className="text-2xl text-muted"> / {summary.total}</span>
        </p>
        <p className="text-lg text-foreground">{t(resultMessage(summary))}</p>
      </div>

      {newlyMastered.length > 0 && (
        <div role="status" className="rounded-control border-2 border-success p-3 motion-safe:animate-pop">
          <p className="font-semibold text-success">🎉 {t("mistakes.newlyMastered", { count: newlyMastered.length })}</p>
          <p className="mt-1 text-foreground">{joinList(newlyMastered, settings.locale)}</p>
        </div>
      )}

      {saveFailed && (
        <p role="alert" className="text-sm text-danger">
          {t("practice.saveError")}
        </p>
      )}

      {summary.wrong.length > 0 && (
        <div className="text-left">
          <h3 className="mb-2 text-sm font-medium text-foreground">{t("practice.wrongList")}</h3>
          <ul className="flex flex-wrap gap-2">
            {summary.wrong.map((w) => (
              <li key={w.itemId}>
                <button
                  type="button"
                  onClick={() => services.tts.speak(w.text, language).catch(() => {})}
                  className="rounded-control border border-danger px-3 py-1 text-foreground"
                >
                  {w.text}
                  {w.answer?.trim() && <span className="ml-1 text-xs text-danger line-through">{w.answer.trim()}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {summary.wrong.length > 0 && (
          <Button className="text-base sm:col-span-2" onClick={onRetryWrong}>
            {t("practice.retryWrong")}
          </Button>
        )}
        <Button variant="secondary" onClick={onRetryAll}>
          {t("practice.retryAll")}
        </Button>
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center justify-center rounded-control px-4 text-sm font-medium text-primary hover:bg-primary-soft"
        >
          {t("practice.back")}
        </Link>
      </div>
    </Card>
  );
}
