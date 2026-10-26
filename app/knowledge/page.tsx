"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { KnowledgeLibrary } from "@/components/knowledge/KnowledgeLibrary";
import { RequireStudent } from "@/components/student/RequireStudent";

function FromQuery() {
  const item = useSearchParams().get("item");
  return <RequireStudent>{(student) => <KnowledgeLibrary student={student} focusId={item} />}</RequireStudent>;
}

/** /knowledge (?item=… opens one item, e.g. from a linked task). */
export default function KnowledgePage() {
  return (
    <Suspense fallback={null}>
      <FromQuery />
    </Suspense>
  );
}
