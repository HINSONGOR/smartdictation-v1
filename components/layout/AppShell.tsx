"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeMascot } from "@/components/theme/Mascot";
import { useApp } from "./AppProvider";
import { DESKTOP_NAV_ITEMS, NAV_ITEMS } from "./navItems";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Mobile-first shell:
 *  - phone: top bar + fixed bottom tab bar (respects iPhone safe areas)
 *  - tablet / desktop (md+): top bar with inline navigation, no bottom bar
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { t, currentStudent } = useApp();
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("a11y.skipToContent")}
      </a>
      <header className="sticky top-0 z-20 border-b border-border bg-surface/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-1.5 text-lg font-bold text-primary">
            <ThemeMascot size={32} className="size-8" />
            {t("app.name")}
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label={t("a11y.mainNav")}>
            {DESKTOP_NAV_ITEMS.map(({ href, labelKey }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(pathname, href) ? "bg-primary-soft text-primary" : "text-muted hover:text-foreground"
                }`}
              >
                {t(labelKey)}
              </Link>
            ))}
          </nav>

          <Link
            href="/settings"
            className="ml-auto max-w-[45%] truncate rounded-full bg-primary-soft px-3 py-1 text-sm text-foreground md:ml-0"
            title={t("student.current")}
          >
            {currentStudent?.name ?? t("student.none")}
          </Link>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto outline-none w-full max-w-5xl flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label={t("a11y.mainNav")}
      >
        <ul className="grid grid-cols-5">
          {NAV_ITEMS.map(({ href, labelKey, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] leading-tight ${
                    active ? "text-primary" : "text-muted"
                  }`}
                >
                  <Icon className="size-5" />
                  <span className="line-clamp-1 text-center">{t(labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
