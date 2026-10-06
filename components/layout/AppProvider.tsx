"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createTranslator, type Translate } from "@/lib/i18n";
import { forcedLocaleForPath } from "@/lib/i18n/routeLocale";
import { getServices, type AppServices } from "@/lib/services";
import type { StudentSummary } from "@/lib/student/StudentService";
import { applyTheme } from "@/lib/theme";
import { DEFAULT_SETTINGS, type AppSettings, type Locale, type ThemeName } from "@/types";

interface AppContextValue {
  services: AppServices;
  /** `settings.locale` is the language in effect on this screen (may be forced, e.g. English dictation). */
  settings: AppSettings;
  /** The language chosen in Settings (what the language picker shows). */
  preferredLocale: Locale;
  currentStudent: StudentSummary | null;
  t: Translate;
  setLocale(locale: Locale): Promise<void>;
  setTheme(theme: ThemeName): Promise<void>;
  /** Re-read settings + current student after a service changed them. */
  refresh(): Promise<void>;
}

interface LoadedState {
  services: AppServices;
  settings: AppSettings;
  currentStudent: StudentSummary | null;
}

const AppContext = createContext<AppContextValue | null>(null);

async function load(services: AppServices): Promise<LoadedState> {
  const [settings, currentStudent] = await Promise.all([
    services.settings.get(),
    services.students.getCurrent(),
  ]);
  return { services, settings, currentStudent };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LoadedState | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Local data lives in the browser, so services are created client-side only.
    load(getServices()).then(setState);
  }, []);

  const preferredLocale = state?.settings.locale ?? DEFAULT_SETTINGS.locale;
  const locale = forcedLocaleForPath(pathname) ?? preferredLocale;
  const theme = state?.settings.theme;

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (theme) applyTheme(theme);
  }, [theme]);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const refresh = useCallback(async () => {
    setState(await load(getServices()));
  }, []);

  const setLocale = useCallback(async (next: Locale) => {
    const settings = await getServices().settings.setLocale(next);
    setState((prev) => (prev ? { ...prev, settings } : prev));
  }, []);

  const setTheme = useCallback(async (next: ThemeName) => {
    const settings = await getServices().settings.setTheme(next);
    setState((prev) => (prev ? { ...prev, settings } : prev));
  }, []);

  const value = useMemo<AppContextValue | null>(
    () =>
      state
        ? {
            ...state,
            settings: { ...state.settings, locale },
            preferredLocale,
            t,
            setLocale,
            setTheme,
            refresh,
          }
        : null,
    [state, locale, preferredLocale, t, setLocale, setTheme, refresh],
  );

  if (!value) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted" aria-busy="true">
        {t("app.loading")}
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/** Render a part of a screen in a fixed language (e.g. the English section of Mistake Review). */
export function LocaleScope({ locale, children }: { locale: Locale; children: ReactNode }) {
  const parent = useApp();
  const value = useMemo<AppContextValue>(
    () => ({ ...parent, settings: { ...parent.settings, locale }, t: createTranslator(locale) }),
    [parent, locale],
  );
  return (
    <AppContext.Provider value={value}>
      <div lang={locale}>{children}</div>
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
