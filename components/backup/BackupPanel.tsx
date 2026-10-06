"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { formatDate, formatDateTime } from "@/components/stats/format";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { ErrorText } from "@/components/ui/TextInput";
import type { ParsedBackup } from "@/lib/backup/backupFormat";
import { errorMessage, joinList } from "@/lib/i18n";
import type { BackupCounts, ImportMode } from "@/types";
import { canShareFiles, downloadTextFile, shareTextFile } from "./fileActions";

/** Owner Settings → backup: export / share a JSON file, import with merge or replace. */
export function BackupPanel({ onImported }: { onImported: () => Promise<void> }) {
  const { t, services, settings } = useApp();
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [current, setCurrent] = useState<BackupCounts | null>(null);
  const [busy, setBusy] = useState(false);
  const shareable = canShareFiles();

  useEffect(() => {
    services.backup.lastBackupAt().then(setLastBackupAt);
  }, [services]);

  const contents = (c: BackupCounts) => t("backup.contents", { ...c });

  async function exportBackup(share: boolean) {
    setError(null);
    const backup = await services.backup.createBackup();
    try {
      if (share) await shareTextFile(backup.fileName, backup.json);
      else downloadTextFile(backup.fileName, backup.json);
      setNotice(t("backup.exported", { ...backup.counts }));
    } catch {
      // Share sheet dismissed — nothing to report.
    }
    setLastBackupAt(await services.backup.lastBackupAt());
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow choosing the same file again
    if (!file) return;
    setNotice(null);
    setError(null);
    setMode("merge");
    setConfirmReplace(false);
    try {
      setParsed(services.backup.readBackup(await file.text()));
      setCurrent(await services.backup.currentCounts());
    } catch (err) {
      setParsed(null);
      setError(err instanceof Error && err.name === "ServiceError" ? errorMessage(t, err) : t("backup.readError"));
    }
  }

  async function runImport() {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await services.backup.importBackup(parsed, mode);
      const lines = [t(mode === "merge" ? "backup.importedMerge" : "backup.importedReplace", { ...result.counts })];
      if (result.renamed.length) {
        lines.push(t("backup.renamed", { names: joinList(result.renamed.map(([from, to]) => `${from} → ${to}`), settings.locale) }));
      }
      setParsed(null);
      setNotice(lines.join(" "));
      await onImported();
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t("backup.title")}</h3>
        <p className="mt-1 text-xs text-muted">{t("backup.intro")}</p>
      </div>

      <p className={`text-sm ${lastBackupAt ? "text-muted" : "text-foreground"}`}>
        {lastBackupAt ? t("backup.lastBackup", { date: formatDateTime(lastBackupAt, settings.locale) }) : t("backup.never")}
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => exportBackup(false)}>{t("backup.export")}</Button>
        {shareable && (
          <Button variant="secondary" onClick={() => exportBackup(true)}>
            {t("backup.share")}
          </Button>
        )}
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-border bg-primary-soft px-4 text-sm font-medium text-foreground hover:bg-surface-muted focus-within:outline-2 focus-within:outline-primary">
          {t("backup.import")}
          <input
            type="file"
            accept="application/json,.json"
            onChange={chooseFile}
            aria-label={t("backup.chooseFile")}
            className="sr-only"
          />
        </label>
      </div>
      <p className="text-xs text-muted">{t("backup.pinNotice")}</p>

      {notice && (
        <p role="status" className="rounded-control bg-surface-muted p-2 text-sm text-success">
          {notice}
        </p>
      )}
      <ErrorText>{error}</ErrorText>

      {parsed && (
        <div className="space-y-3 rounded-control border-2 border-primary p-3">
          <div className="text-sm">
            <p className="font-medium text-foreground">{t("backup.preview", { date: formatDate(parsed.file.exportedAt, settings.locale) })}</p>
            <p className="text-muted">{contents(parsed.counts)}</p>
            {parsed.orphansDropped > 0 && <p className="text-xs text-muted">{t("backup.orphans", { count: parsed.orphansDropped })}</p>}
          </div>

          <Segmented
            label={t("backup.mode")}
            value={mode}
            onChange={(v) => {
              setMode(v);
              setConfirmReplace(false);
            }}
            options={[
              { value: "merge", label: t("backup.mode.merge"), description: t("backup.mode.merge.desc") },
              { value: "replace", label: t("backup.mode.replace"), description: t("backup.mode.replace.desc") },
            ]}
          />

          {mode === "replace" && (
            <div role="alert" className="space-y-2 rounded-control border-2 border-danger p-3 text-sm">
              <p className="text-foreground">{t("backup.replaceWarning", { contents: current ? contents(current) : "…" })}</p>
              <Button variant="secondary" className="min-h-10" onClick={() => exportBackup(false)}>
                {t("backup.backupFirst")}
              </Button>
              <label className="flex min-h-11 items-center gap-2 text-foreground">
                <input
                  type="checkbox"
                  checked={confirmReplace}
                  onChange={(e) => setConfirmReplace(e.target.checked)}
                  className="size-5 accent-[var(--sd-danger)]"
                />
                {t("backup.replaceConfirm")}
              </label>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant={mode === "replace" ? "danger" : "primary"}
              disabled={busy || (mode === "replace" && !confirmReplace)}
              onClick={runImport}
            >
              {t("backup.doImport")}
            </Button>
            <Button variant="secondary" onClick={() => setParsed(null)}>
              {t("backup.cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
