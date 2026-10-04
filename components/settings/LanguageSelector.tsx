"use client";

import { useApp } from "@/components/layout/AppProvider";
import { LOCALES } from "@/types";

export function LanguageSelector() {
  const { t, settings, setLocale } = useApp();

  return (
    <div className="flex gap-2" role="radiogroup" aria-label={t("settings.language")}>
      {LOCALES.map((locale) => {
        const selected = settings.locale === locale;
        return (
          <button
            key={locale}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setLocale(locale)}
            className={`min-h-11 flex-1 rounded-control border px-4 text-sm font-medium sm:flex-none ${
              selected ? "border-primary bg-primary text-on-primary" : "border-border bg-surface text-foreground"
            }`}
          >
            {t(`locale.${locale}`)}
          </button>
        );
      })}
    </div>
  );
}
