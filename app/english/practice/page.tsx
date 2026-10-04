"use client";

import { ListFromQuery } from "@/components/dictation/ListFromQuery";
import { PracticePage } from "@/components/dictation/practice/PracticePage";

export default function EnglishPracticePage() {
  return <ListFromQuery>{(listId) => <PracticePage language="en" listId={listId} />}</ListFromQuery>;
}