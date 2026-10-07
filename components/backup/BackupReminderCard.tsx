"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { formatDateTime } from "@/components/stats/format";
import type { BackupReminder } from "@/lib/backup/reminder";
import type { CloudStatus } from "@/lib/cloud/CloudSyncService";

/**
 * Home-screen data status: "synced to the cloud" when the family account is logged in,
 * otherwise a nudge when the device's data hasn't been backed up for a while.
 */
export function BackupReminderCard() {
  const { t, services, settings } = useApp();
  const [reminder, setReminder] = useState<BackupReminder>({ kind: "none" });
  const [cloud, setCloud] = useState<CloudStatus>(() => services.cloud.getStatus());

  useEffect(() => {
    services.backup.reminder().then(setReminder);
  }, [services]);

  useEffect(() => services.cloud.subscribe(setCloud), [services]);

  if (cloud.state === "loading") return null;

  if (cloud.state === "signedIn") {
    return (
      <Link
        href="/settings"
        className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 shadow-card transition hover:bg-surface-muted"
      >
        <span aria-hidden="true" className="text-2xl">
          ☁️
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground">{t("cloud.homeSynced")}</span>
          <span className="block text-sm text-muted">
            {cloud.syncing
              ? t("cloud.syncing")
              : cloud.lastSyncedAt
                ? t("cloud.lastSynced", { time: formatDateTime(cloud.lastSyncedAt, settings.locale) })
                : t("cloud.neverSynced")}
          </span>
        </span>
      </Link>
    );
  }

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
