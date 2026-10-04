"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import type { BackupReminder } from "@/lib/backup/reminder";

/** Home-screen nudge when the device's data hasn't been backed up for a while. */
export function BackupReminderCard() {
  const { t, services } = useApp();
  const [reminder, setReminder] = useState<BackupReminder>({ kind: "none" });

  useEffect(() => {
    services.backup.reminder().then(setReminder);
  }, [services]);

  if (reminder.kind === "none") return null;

  return (
    <Link
      href="/settings"
      className="flex items-center gap-3 rounded-card border-2 border-reveal bg-surface p-4 shadow-card transition hover:bg-surface-muted"
    >
      <span aria-hidden="true" className="text-2xl">
        💾
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground">
          {reminder.kind === "never" ? t("backupReminder.never") : t("backupReminder.overdue", { days: reminder.days })}
        </span>
        <span className="block text-sm text-muted">{t("backupReminder.hint")}</span>
      </span>
      <span className="text-sm font-medium text-primary">{t("backupReminder.go")}</span>
    </Link>
  );
}
