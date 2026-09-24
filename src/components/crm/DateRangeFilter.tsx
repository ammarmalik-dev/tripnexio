"use client";

import { X } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { DATE_RANGE_PRESETS } from "./useDateRangeFilter";

interface DateRangeFilterProps {
  idPrefix: string;
  dateFrom: string;
  dateTo: string;
  onPreset: (days: number) => void;
  onCustomFrom: (dateOnly: string) => void;
  onCustomTo: (dateOnly: string) => void;
  onClear: () => void;
}

/**
 * Step 54 — the one date-range filter UI reused across every CRM list
 * screen: Last 7/30/90 Days quick buttons plus a custom From/To range.
 * Pairs with the `useDateRangeFilter` hook, which owns the actual state.
 */
export function DateRangeFilter({ idPrefix, dateFrom, dateTo, onPreset, onCustomFrom, onCustomTo, onClear }: DateRangeFilterProps) {
  const fromValue = dateFrom ? dateFrom.slice(0, 10) : "";
  const toValue = dateTo ? dateTo.slice(0, 10) : "";
  const hasRange = Boolean(dateFrom || dateTo);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DATE_RANGE_PRESETS.map((preset) => (
        <Button key={preset.days} type="button" variant="ghost" size="sm" onClick={() => onPreset(preset.days)}>
          {preset.label}
        </Button>
      ))}

      <label htmlFor={`${idPrefix}-date-from`} className="sr-only">
        From date
      </label>
      <input
        id={`${idPrefix}-date-from`}
        type="date"
        value={fromValue}
        max={toValue || undefined}
        onChange={(event) => onCustomFrom(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false), "w-auto")}
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
        className={cn(fieldControlClass, fieldBorderClass(false), "w-auto")}
      />

      {hasRange ? (
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Clear dates
        </Button>
      ) : null}
    </div>
  );
}
