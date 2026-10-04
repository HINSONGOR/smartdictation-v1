import type { ComponentType, SVGProps } from "react";
import type { MessageKey } from "@/lib/i18n";
import { ChartIcon, ChineseIcon, EnglishIcon, HomeIcon, MistakesIcon, SettingsIcon } from "@/components/ui/icons";

export interface NavItem {
  href: string;
  labelKey: MessageKey;
  descKey?: MessageKey;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

export const HOME_ITEM: NavItem = { href: "/dashboard", labelKey: "nav.home", Icon: HomeIcon };

/** The four main features, in dashboard order. */
export const FEATURE_ITEMS: NavItem[] = [
  { href: "/chinese", labelKey: "nav.chinese", descKey: "dashboard.chinese.desc", Icon: ChineseIcon },
  { href: "/english", labelKey: "nav.english", descKey: "dashboard.english.desc", Icon: EnglishIcon },
  { href: "/mistakes", labelKey: "nav.mistakes", descKey: "dashboard.mistakes.desc", Icon: MistakesIcon },
  { href: "/settings", labelKey: "nav.settings", descKey: "dashboard.settings.desc", Icon: SettingsIcon },
];

export const PROGRESS_ITEM: NavItem = { href: "/progress", labelKey: "nav.progress", Icon: ChartIcon };

/** Mobile bottom bar (5 slots — progress is reached from the dashboard card). */
export const NAV_ITEMS: NavItem[] = [HOME_ITEM, ...FEATURE_ITEMS];

/** Desktop / tablet top bar has room for progress too. */
export const DESKTOP_NAV_ITEMS: NavItem[] = [HOME_ITEM, ...FEATURE_ITEMS.slice(0, 3), PROGRESS_ITEM, FEATURE_ITEMS[3]];
