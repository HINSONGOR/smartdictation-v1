import { withBase } from "@/lib/basePath";
import { BASIC_THEME_NAMES, CARTOON_THEME_NAMES, THEME_NAMES, type ThemeName } from "@/types";

export { BASIC_THEME_NAMES, CARTOON_THEME_NAMES, THEME_NAMES };

export type MascotId = "cat" | "dino" | "rocket" | "whale" | "unicorn";

export interface ThemePreset {
  kind: "basic" | "cartoon";
  /** Picker preview colour (data for the picker, not component styling). */
  swatch: string;
  /** Browser / Android status-bar colour (<meta name="theme-color">). */
  barColor: string;
  /** Cartoon presets have a mascot illustration (public/mascots/<id>.svg). */
  mascot?: MascotId;
}

/**
 * Preset registry. Real component colours, radius, shadow, font and background
 * pattern live in app/globals.css under [data-theme="<name>"].
 */
export const THEME_PRESETS: Record<ThemeName, ThemePreset> = {
  default: { kind: "basic", swatch: "#f97316", barColor: "#ffffff" },
  blue: { kind: "basic", swatch: "#2563eb", barColor: "#ffffff" },
  green: { kind: "basic", swatch: "#16a34a", barColor: "#ffffff" },
  purple: { kind: "basic", swatch: "#7c3aed", barColor: "#ffffff" },
  pink: { kind: "basic", swatch: "#db2777", barColor: "#ffffff" },
  dark: { kind: "basic", swatch: "#1e293b", barColor: "#1e293b" },
  cat: { kind: "cartoon", swatch: "#d97706", barColor: "#fffdf8", mascot: "cat" },
  dino: { kind: "cartoon", swatch: "#65a30d", barColor: "#fbfff2", mascot: "dino" },
  space: { kind: "cartoon", swatch: "#facc15", barColor: "#24215c", mascot: "rocket" },
  ocean: { kind: "cartoon", swatch: "#0891b2", barColor: "#f7feff", mascot: "whale" },
  unicorn: { kind: "cartoon", swatch: "#c026d3", barColor: "#fffaff", mascot: "unicorn" },
};

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && (THEME_NAMES as readonly string[]).includes(value);
}

export function mascotSrc(mascot: MascotId): string {
  return withBase(`/mascots/${mascot}.svg`);
}

export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_PRESETS[theme].barColor);
}

/**
 * Inline script run before first paint to avoid a theme flash.
 * Theme is a per-device preference, so it reads the local settings key directly
 * even if learning data later moves to a cloud database.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("sd:v1:settings")||"{}");if(${JSON.stringify(THEME_NAMES)}.indexOf(s.theme)>=0)document.documentElement.dataset.theme=s.theme;}catch(e){}})();`;
