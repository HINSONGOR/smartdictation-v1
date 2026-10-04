"use client";

import { useApp } from "@/components/layout/AppProvider";
import { Mascot } from "@/components/theme/Mascot";
import { BASIC_THEME_NAMES, CARTOON_THEME_NAMES, THEME_PRESETS } from "@/lib/theme";
import type { ThemeName } from "@/types";

function ThemeOption({ theme, large }: { theme: ThemeName; large?: boolean }) {
  const { t, settings, setTheme } = useApp();
  const selected = settings.theme === theme;
  const { swatch, mascot } = THEME_PRESETS[theme];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => setTheme(theme)}
      className={`flex min-h-11 flex-col items-center gap-1 rounded-control border bg-surface p-2 text-xs text-foreground transition hover:border-primary ${
        selected ? "border-primary ring-2 ring-primary" : "border-border"
      }`}
    >
      {large && mascot ? (
        <Mascot id={mascot} size={56} className="size-12 sm:size-14" />
      ) : (
        // Swatch preview colour is data for the picker, not component styling.
        <span className="size-6 rounded-full border border-border" style={{ background: swatch }} />
      )}
      {t(`theme.${theme}`)}
    </button>
  );
}

export function ThemeSelector() {
  const { t } = useApp();

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-2 text-xs font-medium text-muted">{t("settings.themeCartoon")}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={t("settings.themeCartoon")}>
          {CARTOON_THEME_NAMES.map((theme) => (
            <ThemeOption key={theme} theme={theme} large />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-muted">{t("settings.themeBasic")}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label={t("settings.themeBasic")}>
          {BASIC_THEME_NAMES.map((theme) => (
            <ThemeOption key={theme} theme={theme} />
          ))}
        </div>
      </div>
    </div>
  );
}
