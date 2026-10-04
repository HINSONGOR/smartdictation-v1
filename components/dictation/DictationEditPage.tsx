"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { RequireStudent } from "@/components/student/RequireStudent";
import { Card } from "@/components/ui/Card";
import type { DictationLanguage, DictationList } from "@/types";
import { DictationEditor } from "./DictationEditor";
import { dictationRoutes } from "./routes";

/**
 * Create (listId undefined) or edit (listId given) a dictation list for the current student.
 * An empty listId (edit page opened without ?list=) shows "not found".
 */
export function DictationEditPage({ language, listId }: { language: DictationLanguage; listId?: string }) {
  const { t } = useApp();
  const editing = listId !== undefined;

  return (
    <>
      <Link href={dictationRoutes.lists(language)} className="mb-2 inline-block text-sm text-primary hover:underline">
        ← {t("dictation.backToLists")}
      </Link>
      <PageHeader title={t(editing ? "dictation.editTitle" : "dictation.newTitle")}>
        {t(language === "zh" ? "nav.chinese" : "nav.english")}
      </PageHeader>
      <RequireStudent>
        {(student) =>
          editing ? (
            <ExistingListEditor studentId={student.id} language={language} listId={listId} />
          ) : (
            <DictationEditor studentId={student.id} language={language} />
          )
        }
      </RequireStudent>
    </>
  );
}

type LoadState = { status: "loading" } | { status: "missing" } | { status: "ready"; list: DictationList };

function ExistingListEditor({
  studentId,
  language,
  listId,
}: {
  studentId: string;
  language: DictationLanguage;
  listId: string;
}) {
  const { t, services } = useApp();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    services.dictation.getForStudent(studentId, listId).then((list) =>
      // A list of another student, or of the other language, is treated as not found.
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
  return <DictationEditor studentId={studentId} language={language} list={state.list} />;
}
