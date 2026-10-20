"use client";

import { X } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

interface DateRangeFilterProps {
  idPrefix: string;
  dateFrom: string;
  dateTo: string;
  /** Kept for callers; the quick 7 / 30 / 90-day buttons were removed (client doc 2026-10-20, L6). */
  onPreset?: (days: number) => void;
  onCustomFrom: (dateOnly: string) => void;
  onCustomTo: (dateOnly: string) => void;
  onClear: () => void;
}

/**
 * Step 54 — the one date-range filter UI reused across every CRM list
 * screen. Client doc 2026-10-20 (L6 / L8–L12) — a compact "Created From / To"
 * calendar pair (no 7 / 30 / 90-day buttons) so each list's filters fit on
 * one line. Pairs with the `useDateRangeFilter` hook, which owns the state.
 */
export function DateRangeFilter({ idPrefix, dateFrom, dateTo, onCustomFrom, onCustomTo, onClear }: DateRangeFilterProps) {
  const fromValue = dateFrom ? dateFrom.slice(0, 10) : "";
  const toValue = dateTo ? dateTo.slice(0, 10) : "";
  const hasRange = Boolean(dateFrom || dateTo);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-ink-tertiary">Created</span>

      <label htmlFor={`${idPrefix}-date-from`} className="sr-only">
        From date
      </label>
      <input
        id={`${idPrefix}-date-from`}
        type="date"
        value={fromValue}
        max={toValue || undefined}
        onChange={(event) => onCustomFrom(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto text-sm")}
      />
      <span className="text-xs text-ink-tertiary">to</span>
      <label htmlFor={`${idPrefix}-date-to`} className="sr-only">
        To date
      </label>
      <input
        id={`${idPrefix}-date-to`}
        type="date"
        value={toValue}
        min={fromValue || undefined}
        onChange={(event) => onCustomTo(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto text-sm")}
      />

      {hasRange ? (
        <Button type="button" variant="ghost" size="sm" className="h-9 px-2" onClick={onClear} aria-label="Clear dates" title="Clear dates">
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
