"use client";

import { DictationEditPage } from "@/components/dictation/DictationEditPage";
import { ListFromQuery } from "@/components/dictation/ListFromQuery";

export default function EditEnglishListPage() {
  return <ListFromQuery>{(listId) => <DictationEditPage language="en" listId={listId} />}</ListFromQuery>;
}