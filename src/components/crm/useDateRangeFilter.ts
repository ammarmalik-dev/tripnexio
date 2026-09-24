"use client";

import { useState } from "react";

export const DATE_RANGE_PRESETS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
] as const;

/**
 * Step 54 — shared date-range filter state for every CRM list screen.
 * Quick presets are relative to right now (a rolling window ending this
 * instant, not "since midnight N days ago"), so dateFrom/dateTo are stored
 * as full ISO timestamps. A custom day picked via the two date inputs is
 * expanded to that day's full start-of-day/end-of-day instant so the range
 * reads as inclusive of both edge days ("from 1 Sept to 30 Sept" includes
 * all of the 30th) — deliberately different from the older Command Centre
 * deep-link convention (bare YYYY-MM-DD, exclusive end), since that's a
 * separate, already-shipped read path this hook doesn't need to match.
 */
export function useDateRangeFilter(initialFrom = "", initialTo = "") {
  const [dateFrom, setDateFrom] = useState(initialFrom);
  const [dateTo, setDateTo] = useState(initialTo);

  function applyPreset(days: number) {
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    setDateFrom(start.toISOString());
    setDateTo(end.toISOString());
  }

  function applyCustomFrom(dateOnly: string) {
    setDateFrom(dateOnly ? new Date(`${dateOnly}T00:00:00.000Z`).toISOString() : "");
  }

  function applyCustomTo(dateOnly: string) {
    setDateTo(dateOnly ? new Date(`${dateOnly}T23:59:59.999Z`).toISOString() : "");
  }

  function clear() {
    setDateFrom("");
    setDateTo("");
  }

  return { dateFrom, dateTo, applyPreset, applyCustomFrom, applyCustomTo, clear };
}
