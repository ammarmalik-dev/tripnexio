import type { ReactNode } from "react";

/**
 * Client 2026-10-28 — the one label / value row of every service request summary step (all six services).
 * Client doc 16 Nov (K6) — two fixed columns (label | value), both left-aligned, so every row's label and value
 * start at the same line instead of values hugging the right edge; a long value (airport name, email, passenger
 * list) wraps inside its column on a 375px phone.
 */
export function SummaryRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-4 border-b border-hairline py-3 last:border-b-0">
      <span className="text-sm text-ink-tertiary">{label}</span>
      <span className="min-w-0 text-sm font-medium wrap-anywhere text-ink-primary">{value}</span>
    </div>
  );
}
