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

/** A pinyin syllable with a tone mark (chūn, tiān, lǜ…). */
const TONED_PINYIN = /[a-zü]*[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ][a-zü]*/giu;
/** A line made only of Latin letters / tone marks (a pinyin line printed above the characters). */
const PINYIN_LINE = /^[\p{Script=Latin}\s'·-]+$/u;

/**
 * Chinese books for Mandarin teaching (普教中) print pinyin above the characters.
 * Keep only the characters: drop pinyin-only lines and stray toned syllables.
 */
function stripPinyin(line: string): string {
  if (PINYIN_LINE.test(line)) return "";
  return line
    .replace(TONED_PINYIN, "")
    .replace(/(?<=[^\x00-\x7F])\s+(?=[^\x00-\x7F])/gu, "") // no gap left between Chinese characters
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Tidy the recognised text for the editor (it is always checked by a parent before saving). */
export function cleanOcrText(text: string, target: Exclude<OcrTarget, "events">, language: DictationLanguage = "en"): string {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    // A removed pinyin line becomes null (dropped), so it doesn't turn into a paragraph break.
    .map((l) => (language === "zh" && l ? stripPinyin(l) || null : l))
    .filter((l): l is string => l !== null);
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

  /** School notice / timetable photo → the AI's JSON answer (parse with lib/scan/scanItems). */
  async readEvents(photo: Photo, language: DictationLanguage, today: string): Promise<string> {
    if (!this.isAvailable()) throw new CloudError("cloud.signInRequired");
    return this.engine.recognize({ image: photo.data, mimeType: photo.mimeType, language, target: "events", today });
  }

  async read(photo: Photo, language: DictationLanguage, target: Exclude<OcrTarget, "events">): Promise<string> {
    if (!this.isAvailable()) throw new CloudError("cloud.signInRequired");
    const text = await this.engine.recognize({ image: photo.data, mimeType: photo.mimeType, language, target });
    return cleanOcrText(text, target, language);
  }
}
