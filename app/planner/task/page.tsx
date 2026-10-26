"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { TaskEditor } from "@/components/planner/TaskEditor";
import { RequireStudent } from "@/components/student/RequireStudent";

function FromQuery() {
  const params = useSearchParams();
  return (
    <RequireStudent>
      {(student) => <TaskEditor studentId={student.id} taskId={params.get("id")} date={params.get("date")} />}
    </RequireStudent>
  );
}

/** /planner/task?id=… (edit) or ?date=… (new) — query params keep the page static and offline-capable. */
export default function TaskPage() {
  return (
    <Suspense fallback={null}>
      <FromQuery />
    </Suspense>
  );
}
