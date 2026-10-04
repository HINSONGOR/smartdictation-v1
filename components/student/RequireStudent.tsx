"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { Card } from "@/components/ui/Card";
import type { StudentSummary } from "@/lib/student/StudentService";

/**
 * Renders learning content only when a student is selected,
 * passing that student down so every query is scoped by studentId.
 */
export function RequireStudent({ children }: { children: (student: StudentSummary) => ReactNode }) {
  const { t, currentStudent } = useApp();

  if (!currentStudent) {
    return (
      <Card>
        <p className="text-sm text-muted">{t("student.requireStudent")}</p>
        <Link href="/settings" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">
          {t("dashboard.goToSettings")}
        </Link>
      </Card>
    );
  }

  // key forces a clean remount when the student changes, so no stale data from another student survives.
  return <div key={currentStudent.id}>{children(currentStudent)}</div>;
}
