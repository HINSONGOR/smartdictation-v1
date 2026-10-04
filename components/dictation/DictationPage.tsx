"use client";

import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequireStudent } from "@/components/student/RequireStudent";
import type { DictationLanguage } from "@/types";
import { DictationListView } from "./DictationListView";

export function DictationPage({ language }: { language: DictationLanguage }) {
  const { t } = useApp();

  return (
    <>
      <PageHeader title={t(language === "zh" ? "nav.chinese" : "nav.english")} />
      <RequireStudent>
        {(student) => <DictationListView studentId={student.id} language={language} />}
      </RequireStudent>
    </>
  );
}
