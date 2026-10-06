import { CloudError } from "@/lib/data/cloud";
import { ServiceError } from "@/lib/errors";
import { DICTATION_LIMITS, MAX_STUDENTS, STUDENT_NAME_MAX_LENGTH, type Locale } from "@/types";
import { en } from "./messages/en";
import { zhHK, type MessageKey, type Messages } from "./messages/zh-HK";

export type { MessageKey } from "./messages/zh-HK";

const DICTIONARIES: Record<Locale, Messages> = {
  "zh-HK": zhHK,
  en,
};

export type TranslateVars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

export function createTranslator(locale: Locale): Translate {
  const dict = DICTIONARIES[locale];
  return (key, vars) => {
    const template = dict[key] ?? zhHK[key] ?? key;
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    );
  };
}

/** "蓋子、蛋糕" in Chinese, "apple, banana" in English. */
export function joinList(items: string[], locale: Locale): string {
  return items.join(locale === "en" ? ", " : "、");
}

/** Text in brackets, using full-width brackets for Chinese. */
export function bracketed(text: string, locale: Locale): string {
  return locale === "en" ? ` (${text})` : `（${text}）`;
}

/** "Label：value" / "Label: value". */
export function labelled(label: string, value: string, locale: Locale): string {
  return locale === "en" ? `${label}: ${value}` : `${label}：${value}`;
}

/** Limits referenced by error messages, so the numbers live only in `types/`. */
const ERROR_VARS: TranslateVars = {
  maxStudents: MAX_STUDENTS,
  nameMax: STUDENT_NAME_MAX_LENGTH,
  titleMax: DICTATION_LIMITS.titleMaxLength,
  maxItems: DICTATION_LIMITS.maxItems,
  itemMax: DICTATION_LIMITS.itemMaxLength,
  maxParagraphs: DICTATION_LIMITS.maxParagraphs,
  paragraphMax: DICTATION_LIMITS.paragraphMaxLength,
};

/** Map any thrown error to a localized message. */
export function errorMessage(t: Translate, error: unknown): string {
  if (error instanceof ServiceError || error instanceof CloudError) return t(`error.${error.code}` as MessageKey, ERROR_VARS);
  return t("error.unknown");
}
