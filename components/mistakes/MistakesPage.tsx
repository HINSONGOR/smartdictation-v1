"use client";

import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequireStudent } from "@/components/student/RequireStudent";
import { MistakeListView } from "./MistakeListView";

export function MistakesPage() {
  const { t } = useApp();

  return (
    <>
      <PageHeader title={t("nav.mistakes")} />
      <RequireStudent>{(student) => <MistakeListView studentId={student.id} />}</RequireStudent>
    </>
  );
}
