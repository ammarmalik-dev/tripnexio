"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * P24 items 5/7/8 — small shared building blocks for the read-only Admin
 * monitoring screens (Bookings, Audit Log, Configuration History, OCR
 * Monitor, Live Activity): a labelled filter <select>, a labelled filter
 * text input, and the loading/error/empty state switch every list uses.
 */

export type FetchState = "loading" | "success" | "error";

export interface FilterOption {
  value: string;
  label: string;
}

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink-tertiary">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false), "w-full min-w-[150px]")}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FilterTextInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  withIcon,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  withIcon?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink-tertiary">
        {label}
      </label>
      <div className="relative">
        {withIcon ? (
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
        ) : null}
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn(fieldControlClass, fieldBorderClass(false), withIcon && "pl-9")}
        />
      </div>
    </div>
  );
}

/**
 * Renders the loading skeleton, the error state (with a retry button), or
 * the empty state — and `children` only once there's data to show.
 */
export function ListStateView({
  state,
  isEmpty,
  errorTitle,
  errorMessage,
  emptyTitle,
  emptyDescription,
  onRetry,
  rows = 6,
  children,
}: {
  state: FetchState;
  isEmpty: boolean;
  errorTitle: string;
  errorMessage: string;
  emptyTitle: string;
  emptyDescription?: string;
  onRetry: () => void;
  rows?: number;
  children: ReactNode;
}) {
  if (state === "loading") {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-hairline bg-surface-1 p-4" aria-busy="true" aria-label="Loading">
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (state === "error") {
    return (
      <ErrorState
        title={errorTitle}
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }
  if (isEmpty) {
    return <EmptyState icon={<Search className="h-5 w-5" aria-hidden="true" />} title={emptyTitle} description={emptyDescription} />;
  }
  return <>{children}</>;
}

/** Hook-free debounce helper value: the caller owns the timer effect; this is just the delay used everywhere. */
export const SEARCH_DEBOUNCE_MS = 300;
