"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { KnowledgeEditor } from "@/components/knowledge/KnowledgeEditor";
import { RequireStudent } from "@/components/student/RequireStudent";
import { KNOWLEDGE_KINDS, type KnowledgeKind } from "@/types";

function FromQuery() {
  const params = useSearchParams();
  const kind = params.get("kind");
  const initialKind: KnowledgeKind = KNOWLEDGE_KINDS.includes(kind as KnowledgeKind) ? (kind as KnowledgeKind) : "note";
  return <RequireStudent>{(student) => <KnowledgeEditor studentId={student.id} itemId={params.get("id")} initialKind={initialKind} />}</RequireStudent>;
}

/** /knowledge/edit?id=… (edit) or ?kind=… (new) — query params keep the page static and offline-capable. */
export default function KnowledgeEditPage() {
  return (
    <Suspense fallback={null}>
      <FromQuery />
    </Suspense>
  );
}
