"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequireStudent } from "@/components/student/RequireStudent";
import { Card } from "@/components/ui/Card";
import type { DictationLanguage, DictationList } from "@/types";
import { dictationRoutes } from "../routes";
import { PracticeFlow } from "./PracticeFlow";

/** Practice one word list. */
export function PracticePage({ language, listId }: { language: DictationLanguage; listId: string }) {
  const { t } = useApp();

  return (
    <>
      <Link href={dictationRoutes.lists(language)} className="mb-2 inline-block text-sm text-primary hover:underline">
        ← {t("practice.quit")}
      </Link>
      <PageHeader title={t("practice.start")}>{t(language === "zh" ? "nav.chinese" : "nav.english")}</PageHeader>
      <RequireStudent>
        {(student) => <PracticeLoader studentId={student.id} language={language} listId={listId} />}
      </RequireStudent>
    </>
  );
}

type LoadState = { status: "loading" } | { status: "missing" } | { status: "ready"; list: DictationList };

function PracticeLoader({ studentId, language, listId }: { studentId: string; language: DictationLanguage; listId: string }) {
  const { t, services } = useApp();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    services.dictation
      .getForStudent(studentId, listId)
      .then((list) =>
        setState(list && list.language === language ? { status: "ready", list } : { status: "missing" }),
      );
  }, [services, studentId, listId, language]);

  if (state.status === "loading") return <p className="text-sm text-muted">{t("app.loading")}</p>;
  if (state.status === "missing") {
    return (
      <Card>
        <p className="text-sm text-muted">{t("dictation.notFound")}</p>
      </Card>
    );
  }
  const { list } = state;
  const paragraphs = list.paragraphs ?? [];
  if (list.items.length === 0 && paragraphs.length === 0) {
    return (
      <Card>
        <p className="text-sm text-muted">{t("practice.emptyList")}</p>
      </Card>
    );
  }
  return (
    <PracticeFlow
      title={list.title}
      language={list.language}
      content={{ kind: "source", source: { language: list.language, words: list.items, paragraphs } }}
      backHref={dictationRoutes.lists(language)}
      onFinish={(session, scope) =>
        services.practice.finish(studentId, {
          list,
          kind: scope === "full" ? "list" : "retry",
          mode: session.mode,
          answers: session.answers,
          startedAt: session.startedAt,
        })
      }
    />
  );
}
