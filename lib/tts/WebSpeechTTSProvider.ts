import type { SpeakOptions, TTSProvider } from "./types";

/**
 * Acceptable voice languages per requested locale, best first.
 * Never falls back across Cantonese / Mandarin — a wrong dialect is worse than the browser default.
 */
const VOICE_FALLBACKS: Record<string, string[]> = {
  "zh-hk": ["zh-hk", "yue-hk", "yue", "zh-yue"],
  "zh-cn": ["zh-cn", "cmn-hans-cn", "zh-tw", "cmn-hant-tw", "cmn"],
};

function normalise(lang: string) {
  return lang.toLowerCase().replace(/_/g, "-");
}

function pickVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const wanted = normalise(lang);
  const candidates = VOICE_FALLBACKS[wanted] ?? [wanted, wanted.split("-")[0]];
  for (const candidate of candidates) {
    const voice =
      voices.find((v) => normalise(v.lang) === candidate) ??
      (candidate.includes("-") ? undefined : voices.find((v) => normalise(v.lang).startsWith(candidate + "-")));
    if (voice) return voice;
  }
  return undefined;
}

export class WebSpeechTTSProvider implements TTSProvider {
  readonly id = "web-speech";

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  speak(text: string, { lang, rate = 1 }: SpeakOptions): Promise<void> {
    if (!this.isSupported()) return Promise.reject(new Error("speechSynthesis unsupported"));

    return new Promise((resolve, reject) => {
      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      const voice = pickVoice(lang);
      if (voice) utterance.voice = voice;

      utterance.onend = () => resolve();
      utterance.onerror = (event) => {
        // "interrupted" / "canceled" happen when stop() or a new speak() is called.
        if (event.error === "interrupted" || event.error === "canceled") resolve();
        else reject(new Error(event.error));
      };
      synth.speak(utterance);
    });
  }

  stop(): void {
    if (this.isSupported()) window.speechSynthesis.cancel();
  }
}
