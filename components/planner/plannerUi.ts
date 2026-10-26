import { dictationRoutes } from "@/components/dictation/routes";
import { mistakeRoutes } from "@/components/mistakes/routes";
import type { Translate } from "@/lib/i18n";
import type { MessageKey } from "@/lib/i18n";
import type { CategoryView, SubjectView } from "@/lib/planner/plannerRules";
import type { DateKey, Locale, PlannerColor, TaskLink } from "@/types";

/** Category / subject colours (dots and stripes only — text stays in theme colours). */
export const COLOR_HEX: Record<PlannerColor, string> = {
  red: "#e5484d",
  orange: "#f76b15",
  amber: "#e2a336",
  green: "#30a46c",
  teal: "#12a594",
  blue: "#3e63dd",
  purple: "#8e4ec6",
  pink: "#d6409f",
  gray: "#8b8d98",
};

export const plannerRoutes = {
  home: () => "/dashboard",
  newTask: (date?: DateKey) => (date ? `/planner/task?date=${date}` : "/planner/task"),
  editTask: (id: string) => `/planner/task?id=${encodeURIComponent(id)}`,
};

/** Where opening a linked task goes (existing dictation screens, or a knowledge-base item). */
export function linkHref(link: TaskLink): string {
  if (link.kind === "dictationList") return dictationRoutes.practice(link.language, link.listId);
  if (link.kind === "mistakeReview") return mistakeRoutes.review(link.language);
  return `/knowledge?item=${encodeURIComponent(link.itemId)}`;
}

export function categoryName(t: Translate, category: CategoryView): string {
  return category.builtIn ? t(`planner.category.${category.id}` as MessageKey) : (category.name ?? "");
}

export function subjectName(t: Translate, subject: SubjectView): string {
  return subject.builtIn ? t(`planner.subject.${subject.id}` as MessageKey) : (subject.name ?? "");
}

/** "10月27日（二）" / "Tue, Oct 27". */
export function formatDay(key: DateKey, locale: Locale): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", weekday: "short" }).format(new Date(y, m - 1, d));
}

export function formatMonth(month: string, locale: Locale): string {
  const [y, m] = month.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(new Date(y, m - 1, 1));
}
