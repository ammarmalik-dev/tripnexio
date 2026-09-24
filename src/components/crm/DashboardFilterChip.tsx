"use client";

import Link from "next/link";
import { X } from "lucide-react";

/**
 * Step 53 — Command Centre's KPI cards deep-link into a list pre-filtered
 * (a date range for period-scoped Sales Overview cards, or a combined
 * multi-status filter for Operations Overview cards like "Active
 * Bookings"). This is a lightweight readout of that filter, not a real
 * filter-builder UI — building the actual date-range picker is explicitly
 * Step 54's job ("Standardize date-range filters ... across major CRM
 * sections"), so this deliberately doesn't try to duplicate it.
 */
export function DashboardFilterChip({
  dateFrom,
  dateTo,
  label,
  clearHref,
}: {
  dateFrom?: string;
  dateTo?: string;
  /** For a filter that isn't a date range (e.g. a combined multi-status link) — takes precedence over dateFrom/dateTo if both are given. */
  label?: string;
  clearHref: string;
}) {
  if (!dateFrom && !dateTo && !label) return null;

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  const resolvedLabel =
    label ??
    (dateFrom && dateTo
      ? `${formatDate(dateFrom)} – ${formatDate(dateTo)}`
      : dateFrom
        ? `From ${formatDate(dateFrom)}`
        : `Until ${formatDate(dateTo!)}`);

  return (
    <div className="flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent-on-light">
      <span>Filtered from Command Centre: {resolvedLabel}</span>
      <Link href={clearHref} className="inline-flex items-center gap-0.5 hover:underline">
        <X className="h-3 w-3" aria-hidden="true" />
        Clear
      </Link>
    </div>
  );
}
