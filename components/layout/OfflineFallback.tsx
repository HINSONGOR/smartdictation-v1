"use client";

import Link from "next/link";
import { ThemeMascot } from "@/components/theme/Mascot";
import { Card } from "@/components/ui/Card";
import { useApp } from "./AppProvider";

export function OfflineFallback() {
  const { t } = useApp();
  return (
    <Card className="mx-auto mt-8 max-w-md space-y-3 text-center">
      <div className="flex justify-center">
        <ThemeMascot size={80} className="size-20" />
      </div>
      <h1 className="text-xl font-bold text-foreground">{t("pwa.offlinePageTitle")}</h1>
      <p className="text-sm text-muted">{t("pwa.offlinePageBody")}</p>
      <Link
        href="/dashboard"
        className="inline-flex min-h-11 items-center justify-center rounded-control bg-primary px-4 text-sm font-medium text-on-primary"
      >
        {t("dashboard.goHome")}
      </Link>
    </Card>
  );
}
