import type { InputHTMLAttributes } from "react";

export function TextInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      // 16px font prevents iOS Safari from zooming into the field.
      className={`min-h-11 w-full rounded-control border border-border bg-surface px-3 text-base text-foreground placeholder:text-muted focus:outline-2 focus:outline-primary ${className}`}
      {...props}
    />
  );
}

/** Numeric 4-digit PIN field (opens the number pad on iPhone / iPad). */
export function PinInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "maxLength">) {
  return (
    <TextInput
      type="password"
      inputMode="numeric"
      pattern="\d{4}"
      maxLength={4}
      autoComplete="off"
      className="tracking-[0.5em] placeholder:tracking-normal"
      {...props}
    />
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-2 text-sm text-danger">
      {children}
    </p>
  );
}
