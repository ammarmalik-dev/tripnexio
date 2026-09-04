import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

/** Shared label + hint + error layout for all form-field primitives. */
export function FormField({ label, htmlFor, error, hint, required, className, children }: FormFieldProps) {
  const errorId = error ? `${htmlFor}-error` : undefined;
  const hintId = hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink-heading">
        {label}
        {required ? (
          <span className="ml-0.5 text-error" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-tertiary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Shared input styling so text/select/date fields stay visually identical. */
export const fieldControlClass =
  "h-11 w-full rounded-md border bg-surface-1 px-3.5 text-sm text-ink-primary placeholder:text-ink-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/25";

export function fieldBorderClass(hasError?: boolean) {
  return hasError
    ? "border-error focus:border-error"
    : "border-hairline focus:border-accent";
}
