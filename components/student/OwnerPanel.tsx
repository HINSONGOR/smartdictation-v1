"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BackupPanel } from "@/components/backup/BackupPanel";
import { useApp } from "@/components/layout/AppProvider";
import { Button } from "@/components/ui/Button";
import { ErrorText, PinInput, TextInput } from "@/components/ui/TextInput";
import { errorMessage } from "@/lib/i18n";
import type { StudentSummary } from "@/lib/student/StudentService";
import { MAX_STUDENTS, STUDENT_NAME_MAX_LENGTH } from "@/types";
import { OwnerPinForm } from "./OwnerPinForm";
import { StudentManageRow } from "./StudentManageRow";

/**
 * Owner Settings: unlock with the owner PIN to manage all student profiles and the owner PIN.
 * Local convenience lock only — not security.
 */
export function OwnerPanel({ onChanged }: { onChanged: () => void }) {
  const { t, services, refresh } = useApp();
  const [unlocked, setUnlocked] = useState(false);
  const [ownerPin, setOwnerPin] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [pinIsDefault, setPinIsDefault] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    services.students.isOwnerPinDefault().then(setPinIsDefault);
  }, [services]);

  async function reload() {
    setStudents(await services.students.listAllForOwner());
  }

  /** After any profile change: reload the list, the app state (header / current student) and the switcher. */
  async function afterChange(message?: string) {
    await reload();
    await refresh();
    onChanged();
    setNotice(message ?? null);
  }

  async function unlock(event: FormEvent) {
    event.preventDefault();
    try {
      await services.students.verifyOwnerPin(ownerPin);
      await reload();
      setUnlocked(true);
      setOwnerPin("");
      setUnlockError(null);
    } catch (err) {
      setUnlockError(errorMessage(t, err));
    }
  }

  async function addStudent(event: FormEvent) {
    event.preventDefault();
    try {
      await services.students.create({ name, pin });
      setName("");
      setPin("");
      setAddError(null);
      await afterChange();
    } catch (err) {
      setAddError(errorMessage(t, err));
    }
  }

  function lock() {
    setUnlocked(false);
    setNotice(null);
  }

  if (!unlocked) {
    return (
      <form onSubmit={unlock} className="space-y-2">
        <label htmlFor="owner-pin" className="block text-sm text-muted">
          {t("owner.enterPin")}
        </label>
        <div className="flex gap-2">
          <PinInput id="owner-pin" value={ownerPin} onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ""))} />
          <Button type="submit" disabled={ownerPin.length !== 4}>
            {t("owner.unlock")}
          </Button>
        </div>
        <ErrorText>{unlockError}</ErrorText>
        {pinIsDefault && <p className="text-xs text-muted">{t("owner.defaultPinWarning")}</p>}
      </form>
    );
  }

  const atLimit = students.length >= MAX_STUDENTS;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {t("owner.students")} · {t("owner.allProfiles", { count: students.length, max: MAX_STUDENTS })}
        </h3>
        <Button variant="ghost" onClick={lock}>
          {t("owner.lock")}
        </Button>
      </div>

      {pinIsDefault && (
        <p role="alert" className="rounded-control border-2 border-reveal p-2 text-sm text-foreground">
          {t("owner.defaultPinWarning")}
        </p>
      )}

      {notice && (
        <p role="status" className="rounded-control bg-surface-muted p-2 text-sm text-success">
          {notice}
        </p>
      )}

      {students.length > 0 && (
        <ul className="divide-y divide-border rounded-control border border-border">
          {students.map((s) => (
            <StudentManageRow key={s.id} student={s} onChanged={afterChange} />
          ))}
        </ul>
      )}

      <form onSubmit={addStudent} className="space-y-2">
        <h3 className="text-sm font-medium text-foreground">{t("owner.addStudent")}</h3>
        <div className="grid gap-2 sm:grid-cols-[1fr_10rem_auto]">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("owner.studentName")}
            aria-label={t("owner.studentName")}
            maxLength={STUDENT_NAME_MAX_LENGTH}
            disabled={atLimit}
          />
          <PinInput
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder={t("owner.studentPin")}
            aria-label={t("owner.studentPin")}
            disabled={atLimit}
          />
          <Button type="submit" disabled={atLimit}>
            {t("owner.add")}
          </Button>
        </div>
        <ErrorText>{atLimit ? t("error.student.limitReached", { maxStudents: MAX_STUDENTS }) : addError}</ErrorText>
      </form>

      <div className="border-t border-border pt-4">
        <BackupPanel onImported={() => afterChange()} />
      </div>

      <div className="border-t border-border pt-4">
        <OwnerPinForm
          onChanged={() => {
            setPinIsDefault(false);
            setNotice(t("owner.pinChanged"));
          }}
        />
      </div>
    </div>
  );
}
