"use client";

import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import type { MessageKey } from "@/lib/i18n";

/** Placeholder for a module of a later stage. */
export function ComingSoon({ titleKey, descKey }: { titleKey: MessageKey; descKey: MessageKey }) {
  const { t } = useApp();
  return (
    <div className="space-y-4">
      <PageHeader title={t(titleKey)} />
      <Card className="space-y-2 text-center">
        <p className="text-4xl" aria-hidden="true">
          🚧
        </p>
        <p className="font-semibold text-foreground">{t("comingSoon.title")}</p>
        <p className="text-sm text-muted">{t(descKey)}</p>
      </Card>
    </div>
  );
}
