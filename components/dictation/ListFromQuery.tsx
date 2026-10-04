"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { LIST_PARAM } from "./routes";

function Reader({ children }: { children: (listId: string) => ReactNode }) {
  const listId = useSearchParams().get(LIST_PARAM) ?? "";
  return <>{children(listId)}</>;
}

/**
 * Reads ?list=<id> on the client, so edit / practice pages can be prerendered as static
 * HTML (cached by the service worker and usable offline) instead of server-rendered per id.
 */
export function ListFromQuery({ children }: { children: (listId: string) => ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Reader>{children}</Reader>
    </Suspense>
  );
}
