"use client";

import { useMemo } from "react";
import { useApp } from "@/components/layout/AppProvider";
import { Button } from "@/components/ui/Button";
import { categoryFor, monthGrid, parseDateKey, tasksByDay } from "@/lib/planner/plannerRules";
import type { PlannerOptions } from "@/lib/planner/PlannerService";
import type { DateKey, StudentTask } from "@/types";
import { COLOR_HEX, formatDay, formatMonth } from "./plannerUi";

const MAX_DOTS = 3;

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Month view: each day shows coloured dots for its tasks; tapping a day selects it. */
export function MonthCalendar({
  tasks,
  options,
  month,
  selected,
  today,
  onMonth,
  onSelect,
}: {
  tasks: StudentTask[];
  options: PlannerOptions;
  month: string;
  selected: DateKey;
  today: DateKey;
  onMonth: (month: string) => void;
  onSelect: (day: DateKey) => void;
}) {
  const { t, settings } = useApp();
  const byDay = useMemo(() => tasksByDay(tasks), [tasks]);
  const grid = monthGrid(month);
  const weekdays = grid.slice(0, 7).map((d) => new Intl.DateTimeFormat(settings.locale, { weekday: "narrow" }).format(parseDateKey(d)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" aria-label={t("planner.prevMonth")} onClick={() => onMonth(shiftMonth(month, -1))}>
          ‹
        </Button>
        <h2 className="text-base font-semibold text-foreground">{formatMonth(month, settings.locale)}</h2>
        <Button variant="ghost" aria-label={t("planner.nextMonth")} onClick={() => onMonth(shiftMonth(month, 1))}>
          ›
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted" aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {grid.map((day) => {
          const dayTasks = byDay.get(day) ?? [];
          const inMonth = day.startsWith(month);
          const isSelected = day === selected;
          const open = dayTasks.filter((task) => !task.done);
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={isSelected}
              aria-label={`${formatDay(day, settings.locale)}${dayTasks.length ? ` · ${t("planner.taskCount", { n: dayTasks.length })}` : ""}`}
              className={`flex min-h-14 flex-col items-center gap-1 rounded-control border p-1 text-sm transition-colors ${
                isSelected ? "border-primary bg-primary-soft" : "border-transparent hover:bg-surface-muted"
              } ${inMonth ? "text-foreground" : "text-muted opacity-60"}`}
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full ${day === today ? "bg-primary font-semibold text-on-primary" : ""}`}
              >
                {Number(day.slice(8))}
              </span>
              <span className="flex h-2 items-center gap-0.5" aria-hidden="true">
                {(open.length ? open : dayTasks).slice(0, MAX_DOTS).map((task) => (
                  <span
                    key={task.id}
                    className={`size-1.5 rounded-full ${task.done ? "opacity-40" : ""}`}
                    style={{ backgroundColor: COLOR_HEX[categoryFor(task, options.categories).color] }}
                  />
                ))}
                {dayTasks.length > MAX_DOTS && <span className="text-[9px] leading-none text-muted">+</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
