"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { Card } from "@/components/ui/Card";
import type { StatsOverview } from "@/lib/stats/statsCalc";
import { formatPercent } from "./format";

/** Dashboard card: streak · sessions this week · accuracy, linking to the progress page. */
export function ProgressSummaryCard({ studentId }: { studentId: string }) {
  const { t, services, settings } = useApp();
  const [overview, setOverview] = useState<StatsOverview | null>(null);

  useEffect(() => {
    services.stats.overview(studentId).then(setOverview);
  }, [services, studentId]);

  if (!overview) return null;

  return (
    <Link href="/progress" className="block">
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 transition hover:border-primary">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{t("nav.progress")}</p>
          <p className="text-sm text-muted">
            {overview.sessions === 0
              ? t("progress.never")
              : `🔥 ${t("progress.streakValue", { count: overview.streak })} · ${t("progress.weekSummary", {
                  count: overview.sessionsLast7Days,
                })} · ${t("progress.accuracy")} ${formatPercent(overview.accuracy, settings.locale)}`}
          </p>
        </div>
        <span className="text-sm font-medium text-primary">{t("progress.open")}</span>
      </Card>
    </Link>
  );
}
