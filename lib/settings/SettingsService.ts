import type { SettingsRepository } from "@/lib/data";
import { isThemeName } from "@/lib/theme";
import { DEFAULT_SETTINGS, LOCALES, type AppSettings, type Locale, type ThemeName } from "@/types";

/** Stored data may be old or hand-edited — fall back to defaults for unknown values. */
function sanitize(settings: AppSettings): AppSettings {
  return {
    ...settings,
    locale: (LOCALES as readonly string[]).includes(settings.locale) ? settings.locale : DEFAULT_SETTINGS.locale,
    theme: isThemeName(settings.theme) ? settings.theme : DEFAULT_SETTINGS.theme,
  };
}

export class SettingsService {
  constructor(private readonly settings: SettingsRepository) {}

  async get(): Promise<AppSettings> {
    return sanitize(await this.settings.get());
  }

  async setLocale(locale: Locale): Promise<AppSettings> {
    return this.update({ locale });
  }

  async setTheme(theme: ThemeName): Promise<AppSettings> {
    return this.update({ theme });
  }

  private async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    const next = sanitize({ ...(await this.get()), ...patch });
    await this.settings.save(next);
    return next;
  }
}
