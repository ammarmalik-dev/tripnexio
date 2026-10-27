"use client";

import type { ReactNode } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Client 2026-10-28 — the one filter toolbar for every CRM / Admin list: the filters wrap on the left,
 * and the actions (Refresh / Export CSV) stay on the SAME line as the first row of filters, at the right,
 * at the filters' height (h-9). On narrow screens the actions sit under the filters, right-aligned.
 *
 * Children are laid out as one wrapping row; a child that should take a row of its own (e.g. a grid of
 * dropdowns) passes `basis-full`.
 */
export function ListToolbar({ children, actions, className }: { children?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5 lg:flex-row lg:items-start lg:gap-4", className)}>
      {children ? <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">{children}</div> : <div className="hidden flex-1 lg:block" />}
      {actions ? <div className="flex h-9 shrink-0 items-center justify-end gap-2">{actions}</div> : null}
    </div>
  );
}

/** The shared Refresh button of a list toolbar (h-9, spins while loading). */
export function ListRefreshButton({ onClick, loading, label = "Refresh" }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick} disabled={loading} className="whitespace-nowrap">
      <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden="true" />
      {label}
    </Button>
  );
}
