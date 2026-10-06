"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { bracketed, joinList, labelled } from "@/lib/i18n";
import type { StudentStats } from "@/lib/stats/StatsService";
import { formatDate, formatPercent } from "./format";

/** Compact progress for Owner Settings — lets a parent check any student without switching profile. */
export function StudentStatsInline({ studentId }: { studentId: string }) {
  const { t, services, settings } = useApp();
  const [stats, setStats] = useState<StudentStats | null>(null);

  useEffect(() => {
    services.stats.forStudent(studentId, new Date(), { recent: 3, mistakes: 5 }).then(setStats);
  }, [services, studentId]);

  if (!stats) return <p className="text-xs text-muted">{t("app.loading")}</p>;
  const { overview } = stats;

  const rows: [string, string][] = [
    [t("progress.sessions"), `${overview.sessions}${bracketed(t("progress.weekSummary", { count: overview.sessionsLast7Days }), settings.locale)}`],
    [t("progress.accuracy"), formatPercent(overview.accuracy, settings.locale)],
    [t("progress.streak"), t("progress.streakValue", { count: overview.streak })],
    [t("progress.mistakes"), `${stats.activeMistakes} · ${t("progress.mastered", { count: stats.masteredMistakes })}`],
  ];

  return (
    <div className="space-y-2 rounded-control bg-surface-muted p-3 text-sm">
      <p className="text-xs text-muted">
        {overview.lastPracticeAt
          ? t("progress.lastPractice", { date: formatDate(overview.lastPracticeAt, settings.locale) })
          : t("progress.never")}
      </p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
      {stats.topMistakes.length > 0 && (
        <p className="text-xs text-muted">
          {labelled(t("progress.topMistakes"), joinList(stats.topMistakes.map((m) => m.text), settings.locale), settings.locale)}
        </p>
      )}
    </div>
  );
}
