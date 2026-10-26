"use client";

import { PromptLibrary } from "@/components/prompts/PromptLibrary";
import { RequireStudent } from "@/components/student/RequireStudent";

export default function PromptsPage() {
  return <RequireStudent>{(student) => <PromptLibrary student={student} />}</RequireStudent>;
}
