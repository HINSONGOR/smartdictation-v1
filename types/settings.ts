export const LOCALES = ["zh-HK", "en"] as const;
export type Locale = (typeof LOCALES)[number];

export const BASIC_THEME_NAMES = ["default", "blue", "green", "purple", "pink", "dark"] as const;
export const CARTOON_THEME_NAMES = ["cat", "dino", "space", "ocean", "unicorn"] as const;
export const THEME_NAMES = [...BASIC_THEME_NAMES, ...CARTOON_THEME_NAMES] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

/** Per-device app settings. */
export interface AppSettings {
  locale: Locale;
  theme: ThemeName;
  /** Currently selected student profile on this device (null = none chosen yet). */
  currentStudentId: string | null;
  /** When a backup was last exported from this device. */
  lastBackupAt?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  locale: "zh-HK",
  theme: "default",
  currentStudentId: null,
};
