import type { DictationLanguage } from "@/types";

/**
 * Dictation reads punctuation aloud (teacher style): "我們去公園，" → "我們去公園 逗號，".
 * Pausing marks (，。？！ etc.) are kept after the spoken name so the voice still pauses there.
 */

interface Mark {
  name: string;
  /** Keep the original mark after the name (gives a natural pause). */
  pause: boolean;
}

const ZH_MARKS: Record<string, Mark> = {
  "，": { name: "逗號", pause: true },
  ",": { name: "逗號", pause: true },
  "。": { name: "句號", pause: true },
  "？": { name: "問號", pause: true },
  "?": { name: "問號", pause: true },
  "！": { name: "感嘆號", pause: true },
  "!": { name: "感嘆號", pause: true },
  "、": { name: "頓號", pause: true },
  "：": { name: "冒號", pause: true },
  ":": { name: "冒號", pause: true },
  "；": { name: "分號", pause: true },
  ";": { name: "分號", pause: true },
  "「": { name: "開引號", pause: false },
  "」": { name: "關引號", pause: false },
  "『": { name: "開雙引號", pause: false },
  "』": { name: "關雙引號", pause: false },
  "“": { name: "開引號", pause: false },
  "”": { name: "關引號", pause: false },
  "《": { name: "開書名號", pause: false },
  "》": { name: "關書名號", pause: false },
  "〈": { name: "開篇名號", pause: false },
  "〉": { name: "關篇名號", pause: false },
  "（": { name: "開括號", pause: false },
  "）": { name: "關括號", pause: false },
  "(": { name: "開括號", pause: false },
  ")": { name: "關括號", pause: false },
  "·": { name: "間隔號", pause: false },
  "‧": { name: "間隔號", pause: false },
};

const EN_MARKS: Record<string, Mark> = {
  ",": { name: "comma", pause: true },
  ".": { name: "full stop", pause: true },
  "?": { name: "question mark", pause: true },
  "!": { name: "exclamation mark", pause: true },
  ":": { name: "colon", pause: true },
  ";": { name: "semicolon", pause: true },
  "“": { name: "open quote", pause: false },
  "”": { name: "close quote", pause: false },
  "(": { name: "open bracket", pause: false },
  ")": { name: "close bracket", pause: false },
};

/** Multi-character marks, checked before single characters. */
const ZH_SEQUENCES: [string, Mark][] = [
  ["……", { name: "省略號", pause: true }],
  ["…", { name: "省略號", pause: true }],
  ["——", { name: "破折號", pause: true }],
];
const EN_SEQUENCES: [string, Mark][] = [
  ["...", { name: "dot dot dot", pause: true }],
  ["…", { name: "dot dot dot", pause: true }],
  ["—", { name: "dash", pause: true }],
];

const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
const isLetter = (c: string | undefined) => c !== undefined && /\p{L}/u.test(c);

export function speakablePunctuation(text: string, language: DictationLanguage): string {
  const marks = language === "zh" ? ZH_MARKS : EN_MARKS;
  const sequences = language === "zh" ? ZH_SEQUENCES : EN_SEQUENCES;
  const sep = " ";
  let out = "";
  let quoteOpen = false; // English straight double quotes alternate open / close

  const say = (mark: Mark, original: string) => {
    out += `${sep}${mark.name}${mark.pause ? original : ""}${sep}`;
  };

  for (let i = 0; i < text.length; i++) {
    const seq = sequences.find(([s]) => text.startsWith(s, i));
    if (seq) {
      say(seq[1], seq[0]);
      i += seq[0].length - 1;
      continue;
    }

    const c = text[i];
    if (language === "en") {
      // Decimal point (3.5) and apostrophes (don't) are not read.
      if (c === "." && isDigit(text[i - 1]) && isDigit(text[i + 1])) {
        out += c;
        continue;
      }
      if (c === "-" && isLetter(text[i - 1]) && isLetter(text[i + 1])) {
        say({ name: "hyphen", pause: false }, c);
        continue;
      }
      if (c === '"') {
        say({ name: quoteOpen ? "close quote" : "open quote", pause: false }, c);
        quoteOpen = !quoteOpen;
        continue;
      }
    }

    const mark = marks[c];
    if (mark) say(mark, c);
    else out += c;
  }
  return out.replace(/\s+/g, " ").trim();
}
