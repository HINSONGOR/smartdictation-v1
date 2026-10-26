"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { DICTATION_ITEMS } from "@/components/layout/navItems";
import { mistakeRoutes } from "@/components/mistakes/routes";
import { ProgressSummaryCard } from "@/components/stats/ProgressSummaryCard";

/** 默書 module: entry cards to the existing dictation features (the features themselves are unchanged). */
export function DictationHome() {
  const { t, currentStudent, services } = useApp();
  const [pending, setPending] = useState<{ studentId: string; count: number } | null>(null);

  useEffect(() => {
    if (!currentStudent) return;
    const studentId = currentStudent.id;
    services.mistakes.activeCount(studentId).then((count) => setPending({ studentId, count }));
  }, [services, currentStudent]);

  // Ignore a count that belongs to a previously selected student.
  const pendingCount = pending && pending.studentId === currentStudent?.id ? pending.count : 0;

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.dictation")} />

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {DICTATION_ITEMS.map(({ href, labelKey, descKey, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group relative flex min-h-36 flex-col justify-between rounded-card border border-border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary hover:shadow-card-hover sm:min-h-44 sm:p-5"
          >
            <span className="flex size-12 items-center justify-center rounded-control bg-primary-soft text-primary">
              <Icon className="size-6" />
            </span>
            {href === mistakeRoutes.overview() && pendingCount > 0 && (
              <span className="absolute top-3 right-3 rounded-full bg-danger px-2 py-0.5 text-xs font-medium text-on-primary">
                {t("dashboard.mistakesBadge", { count: pendingCount })}
              </span>
            )}
            <span>
              <span className="block text-base font-semibold text-foreground sm:text-lg">{t(labelKey)}</span>
              {descKey && <span className="mt-1 block text-xs text-muted sm:text-sm">{t(descKey)}</span>}
            </span>
          </Link>
        ))}
      </section>

      {currentStudent && <ProgressSummaryCard key={currentStudent.id} studentId={currentStudent.id} />}
    </div>
  );
}
