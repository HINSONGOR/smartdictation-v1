"use client";

import { useApp } from "@/components/layout/AppProvider";
import { Card } from "@/components/ui/Card";
import { SparkIcon } from "@/components/ui/icons";
import type { MessageKey } from "@/lib/i18n";

const V2_FEATURES: MessageKey[] = ["v2.supabase", "v2.ocr", "v2.ai", "v2.cloudTts", "v2.smartLearning"];

/** Version 2 entry point — informational only, nothing is implemented in V1. */
export function Version2Card() {
  const { t } = useApp();

  return (
    <Card className="border-dashed bg-surface-muted" aria-disabled="true">
      <div className="flex items-center gap-2">
        <SparkIcon className="size-5 text-primary" />
        <h2 className="text-base font-semibold text-foreground">{t("v2.title")}</h2>
        <span className="ml-auto rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">{t("v2.badge")}</span>
      </div>
      <p className="mt-2 text-sm text-muted">{t("v2.subtitle")}</p>
      <ul className="mt-2 grid gap-1 text-sm text-foreground sm:grid-cols-2">
        {V2_FEATURES.map((key) => (
          <li key={key} className="flex items-start gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            {t(key)}
          </li>
        ))}
      </ul>
    </Card>
  );
}
