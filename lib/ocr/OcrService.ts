import type { CloudSyncService } from "@/lib/cloud/CloudSyncService";
import { CloudError, type OcrEngine, type OcrTarget } from "@/lib/data";
import type { DictationLanguage } from "@/types";

export type { OcrTarget } from "@/lib/data";

export interface Photo {
  /** Base64 data (no data: prefix). */
  data: string;
  mimeType: string;
}

/** "1. apple", "2) 蘋果", "• cat", "- dog", "①" → the word only. */
const LIST_MARKER = /^\s*(?:[(（]?\d{1,3}[.)）、:：]|[•·●○▪\-–*]|[①-⑳])\s*/u;

/** Tidy the recognised text for the editor (it is always checked by a parent before saving). */
export function cleanOcrText(text: string, target: OcrTarget): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim());
  if (target === "words") {
    return lines
      .map((l) => l.replace(LIST_MARKER, "").trim())
      .filter(Boolean)
      .join("\n");
  }
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Photo → text for word lists and passages. Uses the family account's cloud login. */
export class OcrService {
  constructor(
    private readonly engine: OcrEngine,
    private readonly cloud: CloudSyncService,
  ) {}

  /** OCR runs in the cloud, so the family account must be logged in on this device. */
  isAvailable(): boolean {
    return this.cloud.getStatus().state === "signedIn";
  }

  async read(photo: Photo, language: DictationLanguage, target: OcrTarget): Promise<string> {
    if (!this.isAvailable()) throw new CloudError("cloud.signInRequired");
    const text = await this.engine.recognize({ image: photo.data, mimeType: photo.mimeType, language, target });
    return cleanOcrText(text, target);
  }
}
