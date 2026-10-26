"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { BackupReminderCard } from "@/components/backup/BackupReminderCard";
import { useApp } from "@/components/layout/AppProvider";
import { Mascot, ThemeMascot } from "@/components/theme/Mascot";
import { Card } from "@/components/ui/Card";
import { CalendarIcon, TasksIcon } from "@/components/ui/icons";
import { categoryFor, dateKey, todayView } from "@/lib/planner/plannerRules";
import type { StudentSummary } from "@/lib/student/StudentService";
import { THEME_PRESETS } from "@/lib/theme";
import type { DateKey, StudentTask } from "@/types";
import { MonthCalendar } from "./MonthCalendar";
import { categoryName, formatDay, plannerRoutes } from "./plannerUi";
import { TaskRow } from "./TaskRow";
import { usePlanner, type PlannerData } from "./usePlanner";

type View = "today" | "calendar";
const VIEW_KEY = "sd:v1:planner-view";

/** 學生管理中心 — the app's home: today's tasks, countdowns, progress and a calendar. */
export function PlannerHome() {
  const { t, currentStudent, settings } = useApp();
  const mascot = THEME_PRESETS[settings.theme].mascot;

  const greeting = (
    <>
      <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
        {currentStudent ? t("dashboard.greeting", { name: currentStudent.name }) : t("dashboard.greetingNoStudent")}
      </h1>
      {currentStudent && <p className="mt-1 text-sm text-muted sm:text-base">{t("planner.subtitle")}</p>}
      {!currentStudent && (
        <p className="mt-2 text-sm text-muted">
          {t("dashboard.noStudentHint")}{" "}
          <Link href="/settings" className="font-medium text-primary underline-offset-2 hover:underline">
            {t("dashboard.goToSettings")}
          </Link>
        </p>
      )}
    </>
  );

  return (
    <div className="space-y-5">
      {mascot ? (
        <section className="flex items-end gap-3">
          <Mascot id={mascot} size={96} className="size-20 shrink-0 sm:size-24" />
          <div className="relative min-w-0 flex-1 rounded-card border border-border bg-surface p-4 shadow-card">
            <span aria-hidden="true" className="absolute bottom-5 -left-2 size-4 rotate-45 border-b border-l border-border bg-surface" />
            {greeting}
          </div>
        </section>
      ) : (
        <section>{greeting}</section>
      )}

      {currentStudent && <StudentPlanner key={currentStudent.id} student={currentStudent} />}

      <BackupReminderCard />
    </div>
  );
}

function StudentPlanner({ student }: { student: StudentSummary }) {
  const { t, services } = useApp();
  const { data, reload } = usePlanner(student.id);
  // The chosen view is remembered on this device (rendered client-side only, after the app loads).
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "calendar" ? "calendar" : "today";
    } catch {
      return "today";
    }
  });
  const [today, setToday] = useState<DateKey>(() => dateKey(new Date()));

  // Follow the date past midnight.
  useEffect(() => {
    const tick = setInterval(() => setToday(dateKey(new Date())), 60_000);
    return () => clearInterval(tick);
  }, []);

  function choose(next: View) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // ignore
    }
  }

  async function toggle(task: StudentTask) {
    await services.planner.setDone(student.id, task.id, !task.done);
    await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-2 gap-1 rounded-control bg-surface-muted p-1" role="tablist" aria-label={t("planner.view")}>
          {(
            [
              ["today", t("planner.viewToday"), TasksIcon],
              ["calendar", t("planner.viewCalendar"), CalendarIcon],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => choose(value)}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-control text-sm font-medium ${
                view === value ? "bg-surface text-foreground shadow-card" : "text-muted"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
        <Link
          href={plannerRoutes.newTask(today)}
          className="inline-flex min-h-11 shrink-0 items-center rounded-control bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
        >
          {t("planner.addTask")}
        </Link>
      </div>

      {!data ? (
        <p className="text-sm text-muted">{t("app.loading")}</p>
      ) : view === "today" ? (
        <TodayPanel data={data} today={today} onToggle={toggle} />
      ) : (
        <CalendarPanel data={data} today={today} onToggle={toggle} />
      )}
    </div>
  );
}

function TodayPanel({ data, today, onToggle }: { data: PlannerData; today: DateKey; onToggle: (task: StudentTask) => void }) {
  const { t } = useApp();
  const view = todayView(data.tasks, today);
  const remaining = view.total - view.done;
  const allDone = view.total > 0 && remaining === 0;
  const message =
    view.total === 0
      ? t("planner.noTasksToday")
      : allDone
        ? t("planner.allDone")
        : view.done >= 2
          ? t("planner.takeBreak")
          : t("planner.keepGoing", { n: remaining });
  const todo = view.today.filter((task) => !task.done);
  const doneToday = view.today.filter((task) => task.done);

  return (
    <div className="space-y-4">
      {view.countdowns.length > 0 && (
        <ul className="space-y-2" aria-label={t("planner.countdowns")}>
          {view.countdowns.map(({ task, days }) => (
            <li key={task.id} className="flex items-center gap-3 rounded-control border-2 border-reveal bg-surface px-3 py-2">
              <span aria-hidden="true" className="text-xl">
                {categoryFor(task, data.options.categories).icon}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{task.title}</span>
              <span className="shrink-0 text-sm font-bold text-foreground">
                {days === 0 ? t("planner.countdownToday") : days === 1 ? t("planner.countdownTomorrow") : t("planner.countdownDays", { n: days })}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Card className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-foreground">{t("planner.todayTasks")}</h2>
          {allDone && (
            <span className="motion-safe:animate-pop">
              <ThemeMascot size={40} className="size-10" />
            </span>
          )}
        </div>
        <p className="text-3xl font-bold text-foreground">
          {view.done} / {view.total}
        </p>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={view.total}
          aria-valuenow={view.done}
          aria-label={t("planner.todayTasks")}
        >
          <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${view.total ? (view.done / view.total) * 100 : 0}%` }} />
        </div>
        <p className={`text-sm ${allDone ? "font-semibold text-success" : "text-muted"}`}>{message}</p>
      </Card>

      {view.overdue.length > 0 && (
        <Section title={t("planner.overdueTitle")} tone="danger">
          {view.overdue.map((task) => (
            <TaskRow key={task.id} task={task} options={data.options} showDate overdue onToggle={onToggle} />
          ))}
        </Section>
      )}

      {(todo.length > 0 || view.upcoming.length > 0) && (
        <Section title={t("planner.nextUp")}>
          {todo.map((task) => (
            <TaskRow key={task.id} task={task} options={data.options} onToggle={onToggle} />
          ))}
          {view.upcoming.map((task) => (
            <TaskRow key={task.id} task={task} options={data.options} showDate onToggle={onToggle} />
          ))}
        </Section>
      )}

      {doneToday.length > 0 && (
        <Section title={t("planner.doneToday")}>
          {doneToday.map((task) => (
            <TaskRow key={task.id} task={task} options={data.options} onToggle={onToggle} />
          ))}
        </Section>
      )}

      {data.tasks.length === 0 && <EmptyHint />}
    </div>
  );
}

function CalendarPanel({ data, today, onToggle }: { data: PlannerData; today: DateKey; onToggle: (task: StudentTask) => void }) {
  const { t, settings } = useApp();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState<DateKey>(today);
  const dayTasks = data.tasks.filter((task) => task.date === selected);

  return (
    <div className="space-y-4">
      <Card>
        <MonthCalendar
          tasks={data.tasks}
          options={data.options}
          month={month}
          selected={selected}
          today={today}
          onMonth={setMonth}
          onSelect={(day) => {
            setSelected(day);
            if (!day.startsWith(month)) setMonth(day.slice(0, 7));
          }}
        />
      </Card>
      <Section
        title={formatDay(selected, settings.locale)}
        action={
          <Link href={plannerRoutes.newTask(selected)} className="text-sm font-medium text-primary hover:underline">
            {t("planner.addOnDay")}
          </Link>
        }
      >
        {dayTasks.length ? (
          dayTasks.map((task) => (
            <TaskRow key={task.id} task={task} options={data.options} overdue={!task.done && task.date < today} onToggle={onToggle} />
          ))
        ) : (
          <li className="text-sm text-muted">{t("planner.noTasksOnDay")}</li>
        )}
      </Section>
      <Legend data={data} />
    </div>
  );
}

function Legend({ data }: { data: PlannerData }) {
  const { t } = useApp();
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted" aria-label={t("planner.legend")}>
      {data.options.categories.map((c) => (
        <li key={c.id}>
          {c.icon} {categoryName(t, c)}
        </li>
      ))}
    </ul>
  );
}

function Section({
  title,
  tone,
  action,
  children,
}: {
  title: string;
  tone?: "danger";
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className={`text-sm font-semibold ${tone === "danger" ? "text-danger" : "text-foreground"}`}>{title}</h2>
        {action}
      </div>
      <ul className="space-y-2">{children}</ul>
    </section>
  );
}

function EmptyHint() {
  const { t } = useApp();
  return (
    <Card className="space-y-1 text-center">
      <p className="text-3xl" aria-hidden="true">
        📋
      </p>
      <p className="font-medium text-foreground">{t("planner.emptyTitle")}</p>
      <p className="text-sm text-muted">{t("planner.emptyHint")}</p>
    </Card>
  );
}
