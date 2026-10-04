"use client";

import Link from "next/link";
import { BackupReminderCard } from "@/components/backup/BackupReminderCard";
import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { FEATURE_ITEMS } from "@/components/layout/navItems";
import { mistakeRoutes } from "@/components/mistakes/routes";
import { ProgressSummaryCard } from "@/components/stats/ProgressSummaryCard";
import { Mascot } from "@/components/theme/Mascot";
import { THEME_PRESETS } from "@/lib/theme";
import { Version2Card } from "./Version2Card";

export function DashboardHome() {
  const { t, currentStudent, settings, services } = useApp();
  const mascot = THEME_PRESETS[settings.theme].mascot;
  const [pending, setPending] = useState<{ studentId: string; count: number } | null>(null);

  useEffect(() => {
    if (!currentStudent) return;
    const studentId = currentStudent.id;
    services.mistakes.activeCount(studentId).then((count) => setPending({ studentId, count }));
  }, [services, currentStudent]);

  // Ignore a count that belongs to a previously selected student.
  const pendingCount = pending && pending.studentId === currentStudent?.id ? pending.count : 0;

  const greeting = (
    <>
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
        {currentStudent ? t("dashboard.greeting", { name: currentStudent.name }) : t("dashboard.greetingNoStudent")}
      </h1>
      {currentStudent && mascot && <p className="mt-1 text-sm text-muted sm:text-base">{t(`mascot.cheer.${mascot}`)}</p>}
      {!currentStudent && (
        <p className="mt-2 text-sm text-muted">
          {t("dashboard.noStudentHint")}{" "}
          <Link href="/settings" className="font-medium text-primary underline-offset-2 hover:underline">
            {t("dashboard.goToSettings")}
          </Link>
        </p>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      {mascot ? (
        <section className="flex items-end gap-3">
          <Mascot id={mascot} size={96} className="size-20 shrink-0 sm:size-24" />
          {/* Speech bubble */}
          <div className="relative min-w-0 flex-1 rounded-card border border-border bg-surface p-4 shadow-card">
            <span
              aria-hidden="true"
              className="absolute bottom-5 -left-2 size-4 rotate-45 border-b border-l border-border bg-surface"
            />
            {greeting}
          </div>
        </section>
      ) : (
        <section>{greeting}</section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {FEATURE_ITEMS.map(({ href, labelKey, descKey, Icon }) => (
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

      <BackupReminderCard />

      <Version2Card />
    </div>
  );
}
