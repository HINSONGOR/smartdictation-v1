"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/layout/AppProvider";
import type { PlannerOptions } from "@/lib/planner/PlannerService";
import type { StudentTask } from "@/types";

export interface PlannerData {
  tasks: StudentTask[];
  options: PlannerOptions;
}

/** A student's tasks + the family's categories / subjects. Reloads after cloud sync brings data. */
export function usePlanner(studentId: string) {
  const { services, dataVersion } = useApp();
  const [data, setData] = useState<PlannerData | null>(null);

  const reload = useCallback(async () => {
    const [tasks, options] = await Promise.all([services.planner.listTasks(studentId), services.planner.options()]);
    setData({ tasks, options });
  }, [services, studentId]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([services.planner.listTasks(studentId), services.planner.options()]).then(([tasks, options]) => {
      if (!cancelled) setData({ tasks, options });
    });
    return () => {
      cancelled = true;
    };
  }, [services, studentId, dataVersion]);

  return { data, reload };
}
