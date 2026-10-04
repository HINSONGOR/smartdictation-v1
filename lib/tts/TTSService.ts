import type { ChineseVoice, DictationLanguage } from "@/types";
import { speakablePunctuation } from "./punctuationSpeech";
import type { TTSProvider } from "./types";
import { WebSpeechTTSProvider } from "./WebSpeechTTSProvider";

/** Speech locale per dictation language (and Chinese voice). */
export function speechLang(language: DictationLanguage, voice: ChineseVoice = "cantonese"): string {
  if (language === "en") return "en-GB";
  return voice === "mandarin" ? "zh-CN" : "zh-HK";
}

export type TTSProviderId = "web-speech";

export function createTTSProvider(id: TTSProviderId): TTSProvider {
  switch (id) {
    case "web-speech":
      return new WebSpeechTTSProvider();
    default: {
      const unsupported: never = id;
      throw new Error(`Unsupported TTS provider: ${String(unsupported)}`);
    }
  }
}

export interface DictationSpeakOptions {
  /** 0.5 – 2, default 1. */
  rate?: number;
  /** Chinese only: Cantonese (default) or Mandarin. */
  voice?: ChineseVoice;
  /** Read punctuation marks aloud (default true — dictation style). */
  readPunctuation?: boolean;
}

export class TTSService {
  constructor(private readonly provider: TTSProvider) {}

  isSupported(): boolean {
    return this.provider.isSupported();
  }

  speak(text: string, language: DictationLanguage, options: DictationSpeakOptions = {}): Promise<void> {
    const { rate = 1, voice, readPunctuation = true } = options;
    const spoken = readPunctuation ? speakablePunctuation(text, language) : text;
    return this.provider.speak(spoken, { lang: speechLang(language, voice), rate });
  }

  stop(): void {
    this.provider.stop();
  }
}
