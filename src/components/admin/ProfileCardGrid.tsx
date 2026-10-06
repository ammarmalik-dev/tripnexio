"use client";

import { useState, type ReactNode } from "react";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Client corrections 2026-10-05 — profile / card list for Vendors and
 * Coupons: compact summary cards; Open shows that one record's full editor
 * (its existing card) above the grid. The main page never loads every
 * record's details at once.
 */
export function ProfileCardGrid<T extends { id: string; active: boolean }>({
  rows,
  renderSummary,
  renderEditor,
  openLabel = "Open",
}: {
  rows: T[];
  renderSummary: (row: T) => ReactNode;
  renderEditor: (row: T) => ReactNode;
  openLabel?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((row) => row.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {open ? (
        <section className="flex flex-col gap-3 rounded-2xl border border-ink-accent/30 bg-ink-accent/[0.03] p-3">
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpenId(null)}>
              <X className="h-4 w-4" aria-hidden="true" />
              Close
            </Button>
          </div>
          {renderEditor(open)}
        </section>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <article
            key={row.id}
            className={cn(
              "flex flex-col gap-3 rounded-2xl border bg-surface-1 p-5 shadow-[0_6px_18px_rgb(24_42_77/0.05)]",
              row.id === openId ? "border-ink-accent/40" : "border-hairline"
            )}
          >
            <div className="flex-1">{renderSummary(row)}</div>
            <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", row.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
                {row.active ? "Active" : "Disabled"}
              </span>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpenId(row.id === openId ? null : row.id)}>
                {row.id === openId ? "Close" : openLabel}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
