"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { ThemeMascot } from "@/components/theme/Mascot";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { MistakeOverview } from "@/lib/mistakes/MistakeService";
import { MASTERY_STREAK, type DictationLanguage, type MistakeRecord } from "@/types";
import { mistakeRoutes } from "./routes";

const LANGUAGES: DictationLanguage[] = ["zh", "en"];
type Tab = "active" | "mastered";

/** One student's mistakes: review entry points + active / mastered lists. */
export function MistakeListView({ studentId }: { studentId: string }) {
  const { t, services } = useApp();
  const [overview, setOverview] = useState<MistakeOverview | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    services.mistakes.overview(studentId).then(setOverview);
  }, [services, studentId]);

  if (!overview) return <p className="text-sm text-muted">{t("app.loading")}</p>;

  const pending = (language: DictationLanguage) => overview.active.filter((r) => r.language === language).length;

  async function clearMastered() {
    await services.mistakes.clearMastered(studentId);
    setConfirmingClear(false);
    setOverview(await services.mistakes.overview(studentId));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {LANGUAGES.map((language) => {
          const count = pending(language);
          return (
            <Card key={language} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-foreground">{t(`mistakes.review.${language}`)}</h2>
                <p className="text-sm text-muted">{t("mistakes.pendingCount", { count })}</p>
              </div>
              {count > 0 ? (
                <Link
                  href={mistakeRoutes.review(language)}
                  className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
                >
                  ▶ {t("mistakes.startReview")}
                </Link>
              ) : (
                <span className="text-sm text-success">✓</span>
              )}
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted">{t("mistakes.masteryRule", { goal: MASTERY_STREAK })}</p>

      <Card>
        <div className="mb-3 flex gap-2" role="tablist">
          {(["active", "mastered"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`min-h-11 rounded-control px-4 text-sm font-medium ${
                tab === key ? "bg-primary text-on-primary" : "bg-surface-muted text-foreground"
              }`}
            >
              {t(`mistakes.tab.${key}`, { count: overview[key].length })}
            </button>
          ))}
        </div>

        {tab === "active" ? (
          overview.active.length === 0 ? (
            <div className="flex items-center gap-3 py-2">
              <ThemeMascot size={56} className="size-14" />
              <p className="text-sm text-muted">{t("mistakes.allClear")}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {overview.active.map((r) => (
                <ActiveRow key={r.id} record={r} />
              ))}
            </ul>
          )
        ) : overview.mastered.length === 0 ? (
          <p className="text-sm text-muted">{t("mistakes.noneMastered")}</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {overview.mastered.map((r) => (
                <MasteredRow key={r.id} record={r} />
              ))}
            </ul>
            <div className="mt-3">
              {confirmingClear ? (
                <div role="alertdialog" className="space-y-2 rounded-control border border-danger p-3">
                  <p className="text-sm text-foreground">{t("mistakes.clearConfirm")}</p>
                  <div className="flex gap-2">
                    <Button variant="danger" onClick={clearMastered}>
                      {t("mistakes.clearYes")}
                    </Button>
                    <Button variant="secondary" onClick={() => setConfirmingClear(false)}>
                      {t("dictation.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="dangerGhost" onClick={() => setConfirmingClear(true)}>
                  {t("mistakes.clearMastered")}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function LanguageBadge({ language }: { language: DictationLanguage }) {
  const { t } = useApp();
  return (
    <span className="inline-flex min-w-7 justify-center rounded-full bg-primary-soft px-1.5 text-xs text-primary">
      {t(`mistakes.lang.${language}`)}
    </span>
  );
}

function ActiveRow({ record }: { record: MistakeRecord }) {
  const { t, services } = useApp();
  const streak = record.correctStreak ?? 0;

  return (
    <li className="flex items-center gap-3 py-2">
      <LanguageBadge language={record.language} />
      <button
        type="button"
        onClick={() => services.tts.speak(record.text, record.language).catch(() => {})}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-lg text-foreground">{record.text}</span>
        {record.wrongAnswer && (
          <span className="block truncate text-xs text-muted">{t("mistakes.wrongAnswer", { answer: record.wrongAnswer })}</span>
        )}
      </button>
      <div className="shrink-0 text-right">
        <span className="block text-xs text-danger">{t("mistakes.timesWrong", { count: record.count })}</span>
        <span
          className="mt-1 flex justify-end gap-1"
          role="img"
          aria-label={t("mistakes.progress", { streak, goal: MASTERY_STREAK })}
          title={t("mistakes.progress", { streak, goal: MASTERY_STREAK })}
        >
          {Array.from({ length: MASTERY_STREAK }, (_, i) => (
            <span key={i} className={`size-2.5 rounded-full ${i < streak ? "bg-success" : "bg-surface-muted"}`} />
          ))}
        </span>
      </div>
    </li>
  );
}

function MasteredRow({ record }: { record: MistakeRecord }) {
  const { t, settings } = useApp();
  const date = record.masteredAt
    ? new Intl.DateTimeFormat(settings.locale, { dateStyle: "medium" }).format(new Date(record.masteredAt))
    : "";

  return (
    <li className="flex items-center gap-3 py-2">
      <LanguageBadge language={record.language} />
      <span className="min-w-0 flex-1 truncate text-foreground">{record.text}</span>
      <span className="shrink-0 text-xs text-success">✓ {t("mistakes.masteredAt", { date })}</span>
    </li>
  );
}
