"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_VERSION } from "@/lib/config";
import { Version2Card } from "@/components/dashboard/Version2Card";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { OwnerPanel } from "@/components/student/OwnerPanel";
import { StudentSwitcher } from "@/components/student/StudentSwitcher";
import { TTSTestPanel } from "@/components/tts/TTSTestPanel";
import { Card, SectionTitle } from "@/components/ui/Card";
import { LanguageSelector } from "./LanguageSelector";
import { ThemeSelector } from "./ThemeSelector";

export function SettingsView() {
  const { t } = useApp();
  // Bumped when the owner adds / (de)activates a profile so the switcher reloads.
  const [profilesVersion, setProfilesVersion] = useState(0);

  return (
    <div className="space-y-4">
      <PageHeader title={t("settings.title")} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle>{t("student.switch")}</SectionTitle>
          <StudentSwitcher version={profilesVersion} />
          <p className="mt-3 text-xs text-muted">{t("student.pinNotice")}</p>
        </Card>

        <Card>
          <SectionTitle>{t("settings.language")}</SectionTitle>
          <LanguageSelector />
          <SectionTitle className="mt-5">{t("settings.theme")}</SectionTitle>
          <ThemeSelector />
        </Card>

        <Card>
          <SectionTitle>{t("owner.title")}</SectionTitle>
          <OwnerPanel onChanged={() => setProfilesVersion((v) => v + 1)} />
        </Card>

        <Card>
          <SectionTitle>{t("settings.tts")}</SectionTitle>
          <TTSTestPanel />
        </Card>

        <Card className="flex items-center justify-between gap-3">
          <div>
            <SectionTitle className="mb-0">{t("help.title")}</SectionTitle>
            <p className="text-xs text-muted">{t("help.settingsHint")}</p>
          </div>
          <Link
            href="/help"
            className="inline-flex min-h-11 shrink-0 items-center rounded-control bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            {t("help.open")}
          </Link>
        </Card>
      </div>

      <Version2Card />

      <p className="text-center text-xs text-muted">{t("settings.version", { version: APP_VERSION })}</p>
    </div>
  );
}
