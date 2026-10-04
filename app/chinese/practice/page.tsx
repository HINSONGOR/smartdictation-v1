"use client";

import { ListFromQuery } from "@/components/dictation/ListFromQuery";
import { PracticePage } from "@/components/dictation/practice/PracticePage";

export default function ChinesePracticePage() {
  return <ListFromQuery>{(listId) => <PracticePage language="zh" listId={listId} />}</ListFromQuery>;
}