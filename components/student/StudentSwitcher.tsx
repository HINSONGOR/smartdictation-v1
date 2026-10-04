"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { Button } from "@/components/ui/Button";
import { ErrorText, PinInput } from "@/components/ui/TextInput";
import { errorMessage } from "@/lib/i18n";
import type { StudentSummary } from "@/lib/student/StudentService";

/** Pick a student profile on this device (PIN required). */
export function StudentSwitcher({ version }: { version: number }) {
  const { t, services, currentStudent, refresh } = useApp();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    services.students.listSelectable().then(setStudents);
  }, [services, version]);

  function choose(id: string) {
    setSelectedId(id === selectedId ? null : id);
    setPin("");
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedId) return;
    try {
      await services.students.switchTo(selectedId, pin);
      setSelectedId(null);
      setPin("");
      await refresh();
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  async function signOut() {
    await services.students.signOutCurrent();
    await refresh();
  }

  if (students.length === 0) {
    return <p className="text-sm text-muted">{t("student.noProfiles")}</p>;
  }

  const selected = students.find((s) => s.id === selectedId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {students.map((s) => {
          const isCurrent = s.id === currentStudent?.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => choose(s.id)}
              disabled={isCurrent}
              className={`min-h-11 rounded-control border px-4 text-sm font-medium transition-colors ${
                isCurrent
                  ? "border-primary bg-primary text-on-primary"
                  : s.id === selectedId
                    ? "border-primary bg-primary-soft text-foreground"
                    : "border-border bg-surface text-foreground hover:border-primary"
              }`}
            >
              {s.name}
            </button>
          );
        })}
      </div>

      {selected && (
        <form onSubmit={submit} className="space-y-2 rounded-control bg-surface-muted p-3">
          <label className="block text-sm text-foreground" htmlFor="switch-pin">
            {t("student.switchTo", { name: selected.name })}
          </label>
          <div className="flex gap-2">
            <PinInput
              id="switch-pin"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder={t("student.enterPin")}
              autoFocus
            />
            <Button type="submit" disabled={pin.length !== 4}>
              {t("student.confirm")}
            </Button>
          </div>
          <ErrorText>{error}</ErrorText>
        </form>
      )}

      {currentStudent && (
        <Button variant="ghost" onClick={signOut} className="px-0">
          {t("student.signOut")}
        </Button>
      )}
    </div>
  );
}
