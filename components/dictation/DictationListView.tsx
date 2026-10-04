"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { Card, SectionTitle } from "@/components/ui/Card";
import { listTypeOf, type DictationLanguage, type DictationList, type PracticeSession } from "@/types";
import { dictationRoutes } from "./routes";

interface Loaded {
  lists: DictationList[];
  latest: Record<string, PracticeSession>;
}

/** Lists one student's dictation lists. UI → DictationService / PracticeService → Repositories → Local Data. */
export function DictationListView({ studentId, language }: { studentId: string; language: DictationLanguage }) {
  const { t, services, settings } = useApp();
  const [data, setData] = useState<Loaded | null>(null);

  useEffect(() => {
    Promise.all([
      services.dictation.listForStudent(studentId, language),
      services.practice.latestByList(studentId, language),
    ]).then(([lists, latest]) => setData({ lists, latest }));
  }, [services, studentId, language]);

  const dateFormat = new Intl.DateTimeFormat(settings.locale, { dateStyle: "medium" });

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <SectionTitle className="mb-0">{t("dictation.lists")}</SectionTitle>
        <Link
          href={dictationRoutes.create(language)}
          className="inline-flex min-h-11 items-center rounded-control border border-border bg-primary-soft px-4 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          + {t("dictation.new")}
        </Link>
      </div>

      {data === null ? (
        <p className="text-sm text-muted">{t("app.loading")}</p>
      ) : data.lists.length === 0 ? (
        <p className="text-sm text-muted">{t("dictation.empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.lists.map((list) => {
            const last = data.latest[list.id];
            const type = listTypeOf(list);
            const paragraphCount = list.paragraphs?.length ?? 0;
            return (
              <li key={list.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="flex items-center gap-2 font-medium text-foreground">
                    <span className="truncate">{list.title}</span>
                    <span className="shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-normal text-primary">
                      {t(`dictation.type.${type}`)}
                    </span>
                  </p>
                  <p className="flex flex-wrap gap-x-2 text-xs text-muted">
                    {list.items.length > 0 && <span>{t("dictation.itemCount", { count: list.items.length })}</span>}
                    {paragraphCount > 0 && <span>{t("dictation.paragraphCount", { count: paragraphCount })}</span>}
                    <span>{t("dictation.updatedAt", { date: dateFormat.format(new Date(list.updatedAt)) })}</span>
                    {last && (
                      <span className={last.correct === last.total ? "text-success" : "text-primary"}>
                        {t("practice.lastScore", { correct: last.correct, total: last.total })}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={dictationRoutes.edit(language, list.id)}
                    className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-medium text-primary hover:bg-primary-soft"
                  >
                    {t("practice.edit")}
                  </Link>
                  {(list.items.length > 0 || paragraphCount > 0) && (
                    <Link
                      href={dictationRoutes.practice(language, list.id)}
                      className="inline-flex min-h-11 items-center rounded-control bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
                    >
                      ▶ {t("practice.start")}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
