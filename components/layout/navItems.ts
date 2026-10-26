import type { ComponentType, SVGProps } from "react";
import type { MessageKey } from "@/lib/i18n";
import {
  CameraIcon,
  ChartIcon,
  ChineseIcon,
  DictationIcon,
  EnglishIcon,
  MistakesIcon,
  NotebookIcon,
  PromptIcon,
  TasksIcon,
} from "@/components/ui/icons";

export interface NavItem {
  href: string;
  labelKey: MessageKey;
  descKey?: MessageKey;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Other path prefixes that belong to this section (for the active highlight). */
  match?: string[];
}

/**
 * The five modules — phone bottom bar and tablet / desktop top bar.
 * Settings are reached from the student name at the top right.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.planner", Icon: TasksIcon, match: ["/planner"] },
  { href: "/dictation", labelKey: "nav.dictation", Icon: DictationIcon, match: ["/chinese", "/english", "/mistakes", "/progress"] },
  { href: "/knowledge", labelKey: "nav.knowledge", Icon: NotebookIcon },
  { href: "/scan", labelKey: "nav.scan", Icon: CameraIcon },
  { href: "/prompts", labelKey: "nav.prompts", Icon: PromptIcon },
];

/** Inside the dictation module: the existing dictation features (unchanged). */
export const DICTATION_ITEMS: NavItem[] = [
  { href: "/chinese", labelKey: "nav.chinese", descKey: "dashboard.chinese.desc", Icon: ChineseIcon },
  { href: "/english", labelKey: "nav.english", descKey: "dashboard.english.desc", Icon: EnglishIcon },
  { href: "/mistakes", labelKey: "nav.mistakes", descKey: "dashboard.mistakes.desc", Icon: MistakesIcon },
  { href: "/progress", labelKey: "nav.progress", descKey: "dashboard.progress.desc", Icon: ChartIcon },
];

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

export function isNavActive(pathname: string, item: NavItem): boolean {
  return [item.href, ...(item.match ?? [])].some((href) => under(pathname, href));
}
