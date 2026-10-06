"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LocaleScope, useApp } from "@/components/layout/AppProvider";
import { ThemeMascot } from "@/components/theme/Mascot";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { createTranslator } from "@/lib/i18n";
import type { MistakeOverview } from "@/lib/mistakes/MistakeService";
import { MASTERY_STREAK, type DictationLanguage, type MistakeRecord } from "@/types";
import { mistakeRoutes } from "./routes";

type Tab = "active" | "mastered";

/** English section labels always use English (English dictation UI is fully English). */
const english = createTranslator("en");

/** One student's mistakes, split into Chinese and English: review entry + active / mastered lists. */
export function MistakeListView({ studentId }: { studentId: string }) {
  const { t, services } = useApp();
  const [overview, setOverview] = useState<MistakeOverview | null>(null);
  const [language, setLanguage] = useState<DictationLanguage>("zh");

  const reload = useCallback(async () => setOverview(await services.mistakes.overview(studentId)), [services, studentId]);

  useEffect(() => {
    services.mistakes.overview(studentId).then(setOverview);
  }, [services, studentId]);

  if (!overview) return <p className="text-sm text-muted">{t("app.loading")}</p>;

  const byLanguage = (lang: DictationLanguage): MistakeOverview => ({
    active: overview.active.filter((r) => r.language === lang),
    mastered: overview.mastered.filter((r) => r.language === lang),
  });
  const pending = (lang: DictationLanguage) => byLanguage(lang).active.length;
  const tabLabel: Record<DictationLanguage, string> = {
    zh: t("mistakes.review.zh"),
    en: english("mistakes.review.en"),
  };

  const section = (
    <LanguageSection
      key={language}
      studentId={studentId}
      language={language}
      overview={byLanguage(language)}
      onChanged={reload}
    />
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label={t("nav.mistakes")}>
        {(["zh", "en"] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            role="tab"
            aria-selected={language === lang}
            lang={lang === "en" ? "en" : undefined}
            onClick={() => setLanguage(lang)}
            className={`flex min-h-12 items-center justify-center gap-2 rounded-control border-2 px-3 text-base font-semibold ${
              language === lang ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-foreground"
            }`}
          >
            {tabLabel[lang]}
            <span
              className={`rounded-full px-2 text-sm ${language === lang ? "bg-on-primary text-primary" : "bg-primary-soft text-primary"}`}
            >
              {pending(lang)}
            </span>
          </button>
        ))}
      </div>

      {language === "en" ? <LocaleScope locale="en">{section}</LocaleScope> : section}
    </div>
  );
}

/** Review button + active / mastered lists for one language. */
function LanguageSection({
  studentId,
  language,
  overview,
  onChanged,
}: {
  studentId: string;
  language: DictationLanguage;
  overview: MistakeOverview;
  onChanged: () => Promise<void>;
}) {
  const { t, services } = useApp();
  const [tab, setTab] = useState<Tab>("active");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const count = overview.active.length;

  async function removeRecord(recordId: string) {
    await services.mistakes.remove(studentId, recordId);
    await onChanged();
  }

  async function clearMastered() {
    await services.mistakes.clearMastered(studentId, language);
    setConfirmingClear(false);
    await onChanged();
  }

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3">
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
                <ActiveRow key={r.id} record={r} onDelete={() => removeRecord(r.id)} />
              ))}
            </ul>
          )
        ) : overview.mastered.length === 0 ? (
          <p className="text-sm text-muted">{t("mistakes.noneMastered")}</p>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {overview.mastered.map((r) => (
                <MasteredRow key={r.id} record={r} onDelete={() => removeRecord(r.id)} />
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

function ActiveRow({ record, onDelete }: { record: MistakeRecord; onDelete: () => void }) {
  const { t, services } = useApp();
  const streak = record.correctStreak ?? 0;

  return (
    <li className="flex items-center gap-3 py-2">
      <button
        type="button"
        onClick={() => services.tts.speak(record.text, record.language).catch(() => {})}
        className="min-w-0 flex-1 text-left"
      >
        {/* Wrap rather than truncate: passage sentences are long on a phone. */}
        <span className="block text-lg break-words text-foreground">{record.text}</span>
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
      <DeleteButton text={record.text} onConfirm={onDelete} />
    </li>
  );
}

function MasteredRow({ record, onDelete }: { record: MistakeRecord; onDelete: () => void }) {
  const { t, settings } = useApp();
  const date = record.masteredAt
    ? new Intl.DateTimeFormat(settings.locale, { dateStyle: "medium" }).format(new Date(record.masteredAt))
    : "";

  return (
    <li className="flex items-center gap-3 py-2">
      <span className="min-w-0 flex-1 break-words text-foreground">{record.text}</span>
      <span className="shrink-0 text-xs text-success">✓ {t("mistakes.masteredAt", { date })}</span>
      <DeleteButton text={record.text} onConfirm={onDelete} />
    </li>
  );
}

/**
 * Two-tap delete so a child doesn't remove a word by accident: "🗑 刪除" → "確定刪除？".
 * The confirm state resets after a few seconds.
 */
function DeleteButton({ text, onConfirm }: { text: string; onConfirm: () => void }) {
  const { t } = useApp();
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <button
      type="button"
      onClick={() => (confirming ? onConfirm() : setConfirming(true))}
      aria-label={confirming ? t("mistakes.deleteConfirmAria", { text }) : t("mistakes.deleteAria", { text })}
      className={`min-h-11 shrink-0 rounded-control border px-3 text-sm font-medium transition-colors ${
        confirming ? "border-danger bg-danger text-on-primary" : "border-border text-danger hover:border-danger"
      }`}
    >
      {t(confirming ? "mistakes.deleteConfirm" : "mistakes.delete")}
    </button>
  );
}
