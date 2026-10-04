import type { DictationLanguage } from "@/types";

const BASE_PATH: Record<DictationLanguage, string> = {
  zh: "/chinese",
  en: "/english",
};

/** Query parameter carrying the list id on the (static, offline-capable) edit / practice pages. */
export const LIST_PARAM = "list";

export const dictationRoutes = {
  lists: (language: DictationLanguage) => BASE_PATH[language],
  create: (language: DictationLanguage) => `${BASE_PATH[language]}/new`,
  edit: (language: DictationLanguage, listId: string) =>
    `${BASE_PATH[language]}/edit?${LIST_PARAM}=${encodeURIComponent(listId)}`,
  practice: (language: DictationLanguage, listId: string) =>
    `${BASE_PATH[language]}/practice?${LIST_PARAM}=${encodeURIComponent(listId)}`,
};
