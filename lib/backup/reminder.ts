/** Remind the family to back up when data exists and the last backup is this many days old (or never). */
export const BACKUP_REMINDER_DAYS = 14;

export type BackupReminder = { kind: "none" } | { kind: "never" } | { kind: "overdue"; days: number };

export function backupReminder(lastBackupAt: string | null, hasData: boolean, now: Date): BackupReminder {
  if (!hasData) return { kind: "none" };
  if (!lastBackupAt) return { kind: "never" };
  const days = Math.floor((now.getTime() - new Date(lastBackupAt).getTime()) / 86_400_000);
  return days >= BACKUP_REMINDER_DAYS ? { kind: "overdue", days } : { kind: "none" };
}
