"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/TextInput";
import { errorMessage } from "@/lib/i18n";
import type { OcrTarget } from "@/lib/ocr/OcrService";
import { photoFromFile } from "@/lib/ocr/photo";
import type { DictationLanguage } from "@/types";

/**
 * "📷 影相輸入": take / choose a photo, read its text in the cloud (Gemini),
 * and hand the text to the editor — where a parent checks it before saving.
 */
export function PhotoTextButton({
  language,
  target,
  onText,
}: {
  language: DictationLanguage;
  target: Exclude<OcrTarget, "events">;
  onText: (text: string) => string | void;
}) {
  const { t, services } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow the same photo again
    if (!file) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const text = await services.ocr.read(await photoFromFile(file), language, target);
      if (!text) setError(t("dictation.photoEmpty"));
      else setNotice(onText(text) || null);
    } catch (err) {
      setError(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  }

  function open() {
    setNotice(null);
    if (!services.ocr.isAvailable()) {
      setError(t("error.cloud.signInRequired"));
      return;
    }
    setError(null);
    fileRef.current?.click();
  }

  return (
    <div className="space-y-1">
      <Button variant="secondary" disabled={busy} onClick={open}>
        {busy ? t("dictation.photoReading") : t("dictation.photoInput")}
      </Button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={choose} />
      {busy && <p className="text-xs text-muted">{t("dictation.photoTip")}</p>}
      {notice && (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
