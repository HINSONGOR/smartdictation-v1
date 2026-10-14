"use client";

import { useApp } from "@/components/layout/AppProvider";
import type { DiffToken } from "@/lib/dictation/answerDiff";

/**
 * "Red pen" marking of one line.
 *  - answer: wrong / extra pieces struck through in red
 *  - expected: missed / correct-form pieces underlined in red
 */
export function RedPenLine({
  tokens,
  variant,
  className = "",
}: {
  tokens: DiffToken[];
  variant: "answer" | "expected";
  className?: string;
}) {
  const { t } = useApp();
  if (tokens.length === 0) return <span className={`text-muted ${className}`}>{t("practice.noAnswer")}</span>;
  const bad =
    variant === "answer"
      ? "text-danger line-through decoration-2"
      : "text-danger font-bold underline decoration-2 underline-offset-4";
  return (
    <span className={`break-words ${className}`}>
      {tokens.map((token, i) => (
        <span key={i}>
          {token.spaceBefore && " "}
          {token.ok ? token.text : <mark className={`bg-transparent ${bad}`}>{token.text}</mark>}
        </span>
      ))}
    </span>
  );
}
