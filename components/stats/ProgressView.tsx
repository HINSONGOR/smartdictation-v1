"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { mistakeRoutes } from "@/components/mistakes/routes";
import { RequireStudent } from "@/components/student/RequireStudent";
import { ThemeMascot } from "@/components/theme/Mascot";
import { Card, SectionTitle } from "@/components/ui/Card";
import type { StudentStats } from "@/lib/stats/StatsService";
import { bracketed } from "@/lib/i18n";
import { accuracy } from "@/lib/stats/statsCalc";
import { DailyChart } from "./DailyChart";
import { formatDateTime, formatPercent } from "./format";
import { StatTile } from "./StatTile";

export function ProgressPage() {
  const { t } = useApp();
  return (
    <>
      <PageHeader title={t("progress.title")} />
      <RequireStudent>{(student) => <ProgressView studentId={student.id} />}</RequireStudent>
    </>
  );
}

function ProgressView({ studentId }: { studentId: string }) {
  const { t, services, settings } = useApp();
  const [stats, setStats] = useState<StudentStats | null>(null);

  useEffect(() => {
    services.stats.forStudent(studentId).then(setStats);
  }, [services, studentId]);

  if (!stats) return <p className="text-sm text-muted">{t("app.loading")}</p>;

  const { overview } = stats;
  if (overview.sessions === 0) {
    return (
      <Card className="flex items-center gap-3">
        <ThemeMascot size={64} className="size-16 shrink-0" />
        <p className="text-sm text-muted">{t("progress.empty")}</p>
      </Card>
    );
  }

  const pct = (correct: number, total: number) => formatPercent(accuracy(correct, total), settings.locale);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("progress.streak")} value={`🔥 ${t("progress.streakValue", { count: overview.streak })}`} />
        <StatTile
          label={t("progress.sessions")}
          value={overview.sessions}
          sub={t("progress.weekSummary", { count: overview.sessionsLast7Days })}
        />
        <StatTile
          label={t("progress.accuracy")}
          value={formatPercent(overview.accuracy, settings.locale)}
          sub={`${t("progress.items")} ${overview.items}`}
        />
        <StatTile
          label={t("progress.mistakes")}
          value={stats.activeMistakes}
          sub={t("progress.mastered", { count: stats.masteredMistakes })}
        />
      </div>

      <Card>
        <SectionTitle className="mb-0">{t("progress.chartTitle")}</SectionTitle>
        <p className="mb-2 text-xs text-muted">{t("progress.chartSubtitle")}</p>
        <DailyChart days={stats.daily} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>{t("progress.byLanguage")}</SectionTitle>
          <ul className="space-y-2">
            {(["zh", "en"] as const).map((lang) => {
              const totals = overview.byLanguage[lang];
              return (
                <li key={lang} className="flex items-center justify-between gap-3">
                  <span className="text-foreground">{t(`progress.lang.${lang}`)}</span>
                  <span className="text-sm text-muted">
                    {totals.sessions
                      ? `${t("progress.langLine", { sessions: totals.sessions, items: totals.items })} · ${pct(totals.correct, totals.items)}`
                      : t("progress.noneYet")}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionTitle className="mb-0">{t("progress.topMistakes")}</SectionTitle>
            <Link href={mistakeRoutes.overview()} className="text-sm text-primary hover:underline">
              {t("progress.viewMistakes")}
            </Link>
          </div>
          {stats.topMistakes.length === 0 ? (
            <p className="text-sm text-muted">{t("mistakes.allClear")}</p>
          ) : (
            <ol className="divide-y divide-border">
              {stats.topMistakes.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-1.5">
                  <span className="min-w-0 truncate text-foreground">{m.text}</span>
                  <span className="shrink-0 text-xs text-muted">{t("progress.timesWrong", { count: m.count })}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {stats.lists.length > 0 && (
        <Card>
          <SectionTitle>{t("progress.lists")}</SectionTitle>
          <ul className="divide-y divide-border">
            {stats.lists.map((l) => (
              <li key={l.listId} className="flex flex-wrap items-center justify-between gap-x-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-foreground">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{t(`progress.lang.${l.language}`)}</span>
                  <span className="truncate">{l.title}</span>
                </span>
                <span className="text-xs text-muted">
                  {t("progress.listLine", {
                    count: l.timesPractised,
                    correct: l.last.correct,
                    total: l.last.total,
                    best: formatPercent(l.bestAccuracy, settings.locale),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <SectionTitle>{t("progress.recent")}</SectionTitle>
        <ul className="divide-y divide-border">
          {stats.recent.map(({ session, title }) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
              <span className="min-w-0">
                <span className="block truncate text-foreground">
                  {session.kind === "review"
                    ? t("progress.reviewSession")
                    : (title ?? t("progress.deletedList"))}
                  {session.kind === "retry" && <span className="text-xs text-muted">{bracketed(t("progress.kind.retry"), settings.locale)}</span>}
                </span>
                <span className="block text-xs text-muted">
                  {formatDateTime(session.finishedAt, settings.locale)} · {t(`practice.mode.${session.mode}`)}
                </span>
              </span>
              <span className="text-sm font-medium text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                {session.correct}/{session.total} · {pct(session.correct, session.total)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
