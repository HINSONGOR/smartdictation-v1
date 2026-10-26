"use client";

import Link from "next/link";
import { useApp } from "@/components/layout/AppProvider";
import { CheckIcon } from "@/components/ui/icons";
import { categoryFor } from "@/lib/planner/plannerRules";
import type { PlannerOptions } from "@/lib/planner/PlannerService";
import type { StudentTask } from "@/types";
import { COLOR_HEX, categoryName, formatDay, linkHref, plannerRoutes, subjectName } from "./plannerUi";

/**
 * One task: the circle marks it done; the row opens what it links to (e.g. the dictation list)
 * or, without a link, the task itself.
 */
export function TaskRow({
  task,
  options,
  showDate = false,
  overdue = false,
  examTitle,
  onToggle,
}: {
  task: StudentTask;
  options: PlannerOptions;
  showDate?: boolean;
  overdue?: boolean;
  /** For revision tasks: the exam they prepare for. */
  examTitle?: string;
  onToggle: (task: StudentTask) => void;
}) {
  const { t, settings } = useApp();
  const category = categoryFor(task, options.categories);
  const subject = options.subjects.find((s) => s.id === task.subjectId);
  const doneAt =
    task.done && task.doneAt
      ? new Intl.DateTimeFormat(settings.locale, { hour: "numeric", minute: "2-digit" }).format(new Date(task.doneAt))
      : null;
  const details = [
    examTitle ? `📝 ${examTitle}` : categoryName(t, category),
    subject && subjectName(t, subject),
    showDate && formatDay(task.date, settings.locale),
    task.time,
    task.minutes && t("planner.minutes", { n: task.minutes }),
    task.routineId && "🔁",
  ].filter(Boolean);
  const editHref = plannerRoutes.editTask(task.id);

  return (
    <li
      className={`flex items-stretch overflow-hidden rounded-control border bg-surface ${overdue ? "border-danger" : "border-border"}`}
    >
      <span aria-hidden="true" className="w-1.5 shrink-0" style={{ backgroundColor: COLOR_HEX[subject?.color ?? category.color] }} />
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={t(task.done ? "planner.markUndone" : "planner.markDone", { title: task.title })}
        onClick={() => onToggle(task)}
        className="flex w-12 shrink-0 items-center justify-center"
      >
        <span
          className={`flex size-7 items-center justify-center rounded-full border-2 ${
            task.done ? "border-success bg-success text-on-primary" : "border-border text-transparent"
          }`}
        >
          <CheckIcon className="size-4" />
        </span>
      </button>
      <Link href={task.link ? linkHref(task.link) : editHref} className="min-w-0 flex-1 py-2.5 pr-2">
        <span className={`block font-medium ${task.done ? "text-muted line-through" : "text-foreground"}`}>
          <span aria-hidden="true">{category.icon} </span>
          {task.title}
        </span>
        <span className={`block truncate text-xs ${overdue ? "text-danger" : "text-muted"}`}>
          {overdue && `${t("planner.overdue")} · `}
          {doneAt && <span className="font-medium text-success">{t("planner.doneAt", { time: doneAt })} · </span>}
          {details.join(" · ")}
        </span>
      </Link>
      {task.link && (
        <Link
          href={editHref}
          aria-label={t("planner.editTask", { title: task.title })}
          className="flex w-10 shrink-0 items-center justify-center text-muted hover:text-primary"
        >
          ✎
        </Link>
      )}
      <span aria-hidden="true" className="flex w-6 shrink-0 items-center text-muted">
        ›
      </span>
    </li>
  );
}
