"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PracticeFlow } from "@/components/dictation/practice/PracticeFlow";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequireStudent } from "@/components/student/RequireStudent";
import { Card } from "@/components/ui/Card";
import type { DictationLanguage, PracticeItem } from "@/types";
import { mistakeRoutes } from "./routes";

/** Review the current student's active mistakes in one language. */
export function MistakeReviewPage({ language }: { language: DictationLanguage }) {
  const { t } = useApp();

  return (
    <>
      <Link href={mistakeRoutes.overview()} className="mb-2 inline-block text-sm text-primary hover:underline">
        ← {t("practice.quit")}
      </Link>
      <PageHeader title={t("mistakes.reviewSession")}>{t(`mistakes.review.${language}`)}</PageHeader>
      <RequireStudent>{(student) => <ReviewLoader studentId={student.id} language={language} />}</RequireStudent>
    </>
  );
}

function ReviewLoader({ studentId, language }: { studentId: string; language: DictationLanguage }) {
  const { t, services } = useApp();
  // Snapshot of the queue at page load; later runs update records but keep this set.
  const [items, setItems] = useState<PracticeItem[] | null>(null);

  useEffect(() => {
    services.mistakes.reviewItems(studentId, language).then(setItems);
  }, [services, studentId, language]);

  if (!items) return <p className="text-sm text-muted">{t("app.loading")}</p>;
  if (items.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">{t("mistakes.nothingToReview")}</p>
      </Card>
    );
  }

  return (
    <PracticeFlow
      title={t(`mistakes.review.${language}`)}
      language={language}
      content={{ kind: "items", items }}
      backHref={mistakeRoutes.overview()}
      onFinish={(session) =>
        services.practice.finishReview(studentId, {
          language,
          mode: session.mode,
          answers: session.answers,
          startedAt: session.startedAt,
        })
      }
    />
  );
}
