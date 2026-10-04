export interface SpeakOptions {
  /** BCP-47 tag, e.g. "zh-HK", "en-GB". */
  lang: string;
  /** 0.5 – 2, default 1. */
  rate?: number;
}

/**
 * A speech engine. V1: WebSpeechTTSProvider (browser SpeechSynthesis).
 * V2 can add GoogleCloudTTSProvider etc. implementing the same contract.
 */
export interface TTSProvider {
  readonly id: string;
  isSupported(): boolean;
  speak(text: string, options: SpeakOptions): Promise<void>;
  stop(): void;
}
