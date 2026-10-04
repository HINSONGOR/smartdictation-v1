"use client";

import { useState, type FormEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { Button } from "@/components/ui/Button";
import { ErrorText, PinInput } from "@/components/ui/TextInput";
import { errorMessage } from "@/lib/i18n";

/** Change the owner PIN: current PIN + new PIN twice. */
export function OwnerPinForm({ onChanged }: { onChanged: () => void }) {
  const { t, services } = useApp();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);

  const digits = (setter: (v: string) => void) => (e: { target: { value: string } }) => {
    setter(e.target.value.replace(/\D/g, ""));
    setError(null);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (next !== repeat) {
      setError(t("owner.pinMismatch"));
      return;
    }
    try {
      await services.students.changeOwnerPin(current, next);
      setCurrent("");
      setNext("");
      setRepeat("");
      onChanged();
    } catch (err) {
      setError(errorMessage(t, err));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{t("owner.pinTitle")}</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        <PinInput value={current} onChange={digits(setCurrent)} placeholder={t("owner.currentPin")} aria-label={t("owner.currentPin")} />
        <PinInput value={next} onChange={digits(setNext)} placeholder={t("owner.newPin")} aria-label={t("owner.newPin")} />
        <PinInput value={repeat} onChange={digits(setRepeat)} placeholder={t("owner.confirmPin")} aria-label={t("owner.confirmPin")} />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={current.length !== 4 || next.length !== 4 || repeat.length !== 4}>
        {t("owner.changePin")}
      </Button>
    </form>
  );
}
