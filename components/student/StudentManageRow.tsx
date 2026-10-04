"use client";

import { useState, type FormEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { StudentStatsInline } from "@/components/stats/StudentStatsInline";
import { Button } from "@/components/ui/Button";
import { ErrorText, PinInput, TextInput } from "@/components/ui/TextInput";
import { errorMessage } from "@/lib/i18n";
import type { StudentDataSummary, StudentSummary } from "@/lib/student/StudentService";
import { STUDENT_NAME_MAX_LENGTH } from "@/types";

type Mode = { kind: "view" } | { kind: "edit" } | { kind: "delete"; summary: StudentDataSummary | null };

/** One student in Owner Settings: view / edit (name, PIN) / (de)activate / delete with data. */
export function StudentManageRow({
  student,
  onChanged,
}: {
  student: StudentSummary;
  onChanged: (message?: string) => Promise<void>;
}) {
  const { t, services, settings } = useApp();
  const [mode, setMode] = useState<Mode>({ kind: "view" });
  const [name, setName] = useState(student.name);
  const [pin, setPin] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showStats, setShowStats] = useState(false);

  const dateFormat = new Intl.DateTimeFormat(settings.locale, { dateStyle: "medium" });

  function openEdit() {
    setName(student.name);
    setPin("");
    setError(null);
    setMode({ kind: "edit" });
  }

  async function openDelete() {
    setUnderstood(false);
    setError(null);
    setMode({ kind: "delete", summary: null });
    const summary = await services.students.dataSummary(student.id);
    setMode((m) => (m.kind === "delete" ? { kind: "delete", summary } : m));
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await services.students.update(student.id, { name, pin });
      setMode({ kind: "view" });
      await onChanged(t("owner.saved"));
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    await services.students.setActive(student.id, !student.active);
    await onChanged();
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await services.students.remove(student.id);
      await onChanged(t("owner.deleted", { name: student.name }));
    } catch (err) {
      setError(errorMessage(t, err));
      setBusy(false);
    }
  }

  return (
    <li className="space-y-3 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-40">
          <p className="truncate font-medium text-foreground">{student.name}</p>
          <p className="text-xs text-muted">
            {t("owner.createdAt", { date: dateFormat.format(new Date(student.createdAt)) })} ·{" "}
            <span className={student.active ? "text-success" : "text-muted"}>
              {t(student.active ? "owner.active" : "owner.inactive")}
            </span>
          </p>
        </div>
        {mode.kind === "view" && (
          <div className="flex flex-wrap gap-1">
            <Button
              variant="secondary"
              className="min-h-10 px-3"
              aria-expanded={showStats}
              onClick={() => setShowStats((s) => !s)}
            >
              {t(showStats ? "owner.hideStats" : "owner.stats")}
            </Button>
            <Button variant="secondary" className="min-h-10 px-3" onClick={openEdit}>
              {t("owner.edit")}
            </Button>
            <Button variant="secondary" className="min-h-10 px-3" onClick={toggleActive}>
              {t(student.active ? "owner.deactivate" : "owner.activate")}
            </Button>
            <Button variant="dangerGhost" className="min-h-10 px-3" onClick={openDelete}>
              {t("owner.delete")}
            </Button>
          </div>
        )}
      </div>

      {showStats && mode.kind === "view" && <StudentStatsInline studentId={student.id} />}

      {mode.kind === "edit" && (
        <form onSubmit={saveEdit} className="space-y-2 rounded-control bg-surface-muted p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <TextInput
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              aria-label={t("owner.studentName")}
              placeholder={t("owner.studentName")}
              maxLength={STUDENT_NAME_MAX_LENGTH}
              autoFocus
            />
            <PinInput
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              aria-label={t("owner.newPinOptional")}
              placeholder={t("owner.newPinOptional")}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !name.trim() || (pin.length > 0 && pin.length !== 4)}>
              {t("owner.save")}
            </Button>
            <Button variant="secondary" onClick={() => setMode({ kind: "view" })}>
              {t("owner.cancel")}
            </Button>
          </div>
        </form>
      )}

      {mode.kind === "delete" && (
        <div role="alertdialog" aria-label={t("owner.deleteTitle", { name: student.name })} className="space-y-2 rounded-control border-2 border-danger p-3">
          <p className="font-semibold text-danger">{t("owner.deleteTitle", { name: student.name })}</p>
          <p className="text-sm text-foreground">
            {mode.summary ? t("owner.deleteSummary", { ...mode.summary }) : t("owner.loadingSummary")}
          </p>
          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="size-5 accent-[var(--sd-danger)]"
            />
            {t("owner.deleteConfirmCheck")}
          </label>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-2">
            <Button variant="danger" disabled={!understood || !mode.summary || busy} onClick={confirmDelete}>
              {t("owner.deleteYes")}
            </Button>
            <Button variant="secondary" onClick={() => setMode({ kind: "view" })}>
              {t("owner.cancel")}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
