"use client";

import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { APP_VERSION } from "@/lib/config";
import { HELP } from "@/lib/i18n/help";

/** In-app guide for parents and students. Works offline (static page). */
export function HelpView() {
  const { t, settings } = useApp();
  const sections = HELP[settings.locale];

  return (
    <div className="space-y-4">
      <PageHeader title={t("help.title")}>{t("settings.version", { version: APP_VERSION })}</PageHeader>

      <Card>
        <nav aria-label={t("help.contents")}>
          <p className="mb-2 text-sm font-medium text-foreground">{t("help.contents")}</p>
          <ol className="grid gap-1 text-sm sm:grid-cols-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-primary hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </Card>

      {sections.map((s) => (
        <Card key={s.id} id={s.id} className="scroll-mt-20">
          <h2 className="mb-2 text-lg font-semibold text-foreground">{s.title}</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-foreground marker:text-primary">
            {s.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}
