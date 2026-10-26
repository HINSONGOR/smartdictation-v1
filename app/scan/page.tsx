"use client";

import { ScanPage } from "@/components/scan/ScanPage";
import { RequireStudent } from "@/components/student/RequireStudent";

export default function Scan() {
  return <RequireStudent>{(student) => <ScanPage student={student} />}</RequireStudent>;
}
