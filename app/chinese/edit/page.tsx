"use client";

import { DictationEditPage } from "@/components/dictation/DictationEditPage";
import { ListFromQuery } from "@/components/dictation/ListFromQuery";

export default function EditChineseListPage() {
  return <ListFromQuery>{(listId) => <DictationEditPage language="zh" listId={listId} />}</ListFromQuery>;
}