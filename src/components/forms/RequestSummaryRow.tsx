import type { ReactNode } from "react";

/**
 * Client 2026-10-28 — the one label / value row of every service request summary step (all six services),
 * so the rows line up the same way everywhere: label on the left, value right-aligned on the same line, and a
 * long value (airport name, email, passenger list) wraps inside its half instead of pushing the label or
 * overflowing the card on a 375px phone.
 */
export function SummaryRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <span className="max-w-[50%] shrink-0 text-sm text-ink-tertiary">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium wrap-anywhere text-ink-primary">{value}</span>
    </div>
  );
}
