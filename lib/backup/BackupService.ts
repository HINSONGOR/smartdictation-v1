import type { BackupStore, SettingsRepository } from "@/lib/data";
import type { BackupCounts, ImportMode } from "@/types";
import { backupFileName, buildBackupFile, countsOf, parseBackup, type ParsedBackup } from "./backupFormat";
import { mergeSnapshots } from "./mergeSnapshots";
import { backupReminder, type BackupReminder as BackupReminderState } from "./reminder";

export interface CreatedBackup {
  fileName: string;
  json: string;
  counts: BackupCounts;
}

export interface ImportResult {
  mode: ImportMode;
  /** merge: what was added; replace: what the device now holds. */
  counts: BackupCounts;
  renamed: [string, string][];
}

/**
 * Backup export / import of all learning data (owner-level).
 * The owner PIN is never exported or overwritten — whoever imports has just unlocked with
 * this device's PIN, so they can't lock themselves out.
 */
export class BackupService {
  constructor(
    private readonly store: BackupStore,
    private readonly settings: SettingsRepository,
  ) {}

  /** What this device currently holds (shown before a replace). */
  async currentCounts(): Promise<BackupCounts> {
    return countsOf(await this.store.readAll());
  }

  /** Whether the home screen should remind the family to back up. */
  async reminder(now: Date = new Date()): Promise<BackupReminderState> {
    const [last, counts] = await Promise.all([this.lastBackupAt(), this.currentCounts()]);
    return backupReminder(last, counts.students > 0, now);
  }

  async lastBackupAt(): Promise<string | null> {
    return (await this.settings.get()).lastBackupAt ?? null;
  }

  async createBackup(now: Date = new Date()): Promise<CreatedBackup> {
    const snapshot = await this.store.readAll();
    const json = JSON.stringify(buildBackupFile(snapshot, now), null, 2);
    await this.settings.save({ ...(await this.settings.get()), lastBackupAt: now.toISOString() });
    return { fileName: backupFileName(now), json, counts: countsOf(snapshot) };
  }

  /** Parse a chosen file for preview; throws ServiceError("backup.*") when it can't be used. */
  readBackup(text: string): ParsedBackup {
    return parseBackup(text);
  }

  async importBackup(parsed: ParsedBackup, mode: ImportMode): Promise<ImportResult> {
    const incoming = parsed.file.data;
    let result: ImportResult;
    if (mode === "replace") {
      await this.store.replaceAll(incoming);
      result = { mode, counts: countsOf(incoming), renamed: [] };
    } else {
      const merged = mergeSnapshots(await this.store.readAll(), incoming);
      await this.store.replaceAll(merged.snapshot);
      result = { mode, counts: merged.added, renamed: merged.renamed };
    }

    // The selected student may no longer exist (replace).
    const settings = await this.settings.get();
    const remaining = new Set((await this.store.readAll()).students.map((s) => s.id));
    if (settings.currentStudentId && !remaining.has(settings.currentStudentId)) {
      await this.settings.save({ ...settings, currentStudentId: null });
    }
    return result;
  }
}
