import type { DataSource } from "@/lib/data";
import type { TTSProviderId } from "@/lib/tts/TTSService";

/** App version shown in Settings (package.json version, injected by next.config.ts). */
export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/** V1 runtime configuration. V2 switches data source / TTS engine here. */
export const APP_CONFIG: { dataSource: DataSource; ttsProvider: TTSProviderId } = {
  dataSource: "local",
  ttsProvider: "web-speech",
};
