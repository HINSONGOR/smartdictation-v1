"use client";

import { useApp } from "@/components/layout/AppProvider";
import { Button } from "@/components/ui/Button";
import { bracketed } from "@/lib/i18n";

/** Verifies the UI → TTSService → WebSpeechTTSProvider → SpeechSynthesis chain for each voice. */
export function TTSTestPanel() {
  const { t, services, settings } = useApp();
  const { tts } = services;

  if (!tts.isSupported()) {
    return <p className="text-sm text-muted">{t("settings.ttsUnsupported")}</p>;
  }

  const plain = { readPunctuation: false } as const;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        onClick={() => tts.speak(t("settings.ttsSampleZh"), "zh", { ...plain, voice: "cantonese" }).catch(() => {})}
      >
        {t("settings.ttsTestZh")}{bracketed(t("practice.voice.cantonese"), settings.locale)}
      </Button>
      <Button
        variant="secondary"
        onClick={() => tts.speak(t("settings.ttsSampleZh"), "zh", { ...plain, voice: "mandarin" }).catch(() => {})}
      >
        {t("settings.ttsTestZh")}{bracketed(t("practice.voice.mandarin"), settings.locale)}
      </Button>
      <Button variant="secondary" onClick={() => tts.speak(t("settings.ttsSampleEn"), "en", plain).catch(() => {})}>
        {t("settings.ttsTestEn")}
      </Button>
    </div>
  );
}
