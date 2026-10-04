import type { DictationLanguage } from "@/types";

export const mistakeRoutes = {
  overview: () => "/mistakes",
  review: (language: DictationLanguage) => `/mistakes/review/${language}`,
};
