"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PromptEditor } from "@/components/prompts/PromptEditor";
import { RequireStudent } from "@/components/student/RequireStudent";

function FromQuery() {
  const id = useSearchParams().get("id");
  return <RequireStudent>{(student) => <PromptEditor studentId={student.id} promptId={id} />}</RequireStudent>;
}

/** /prompts/edit?id=… (edit) or no id (new) — query params keep the page static and offline-capable. */
export default function PromptEditPage() {
  return (
    <Suspense fallback={null}>
      <FromQuery />
    </Suspense>
  );
}
