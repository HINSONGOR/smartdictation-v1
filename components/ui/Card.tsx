import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-border bg-surface p-4 shadow-card sm:p-5 ${className}`}
      {...props}
    />
  );
}

export function SectionTitle({ className = "", ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={`mb-3 text-base font-semibold text-foreground ${className}`} {...props} />;
}
