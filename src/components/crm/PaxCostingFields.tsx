"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { formatCurrency } from "@/lib/format-currency";
import type { PaxCostingLine } from "@/lib/quotations/pax-costing";

interface Row {
  passengerId: string;
  fullName: string;
  include: boolean;
  cost: string;
  fine: string;
  selling: string;
}

const toNumber = (value: string) => (value.trim() === "" ? 0 : Number(value));

/**
 * Client doc 2026-10-15 (D1/D3, E4) — Visa Extension / Visa Change quote costing, per passenger:
 * cost (what the vendor charges), fine and selling amount, with the totals and the profit
 * (Selling − Cost − Fine; GST applies to the profit). Untick a passenger to leave them out of this
 * quote (partial approval) — the customer then pays for the ticked passengers only.
 */
export function PaxCostingFields({
  passengers,
  initial,
  suggestedSelling,
  onChange,
  error,
}: {
  passengers: { id: string; fullName: string }[];
  /** Saved lines when editing / revising a quote. */
  initial?: PaxCostingLine[];
  /** Visa Change: the Admin-configured rate per passenger, offered as the selling amount. */
  suggestedSelling?: Record<string, number | null>;
  onChange: (lines: PaxCostingLine[]) => void;
  error?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    passengers.map((passenger) => {
      const saved = initial?.find((line) => line.passengerId === passenger.id);
      return {
        passengerId: passenger.id,
        fullName: passenger.fullName,
        include: initial && initial.length > 0 ? Boolean(saved) : true,
        cost: saved ? String(saved.cost) : "",
        fine: saved ? String(saved.fine) : "",
        selling: saved ? String(saved.selling) : "",
      };
    })
  );

  const publish = (next: Row[]) => {
    setRows(next);
    onChange(
      next
        .filter((row) => row.include)
        .map((row) => ({ passengerId: row.passengerId, cost: toNumber(row.cost), fine: toNumber(row.fine), selling: toNumber(row.selling) }))
    );
  };
  const update = (index: number, patch: Partial<Row>) => publish(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const included = rows.filter((row) => row.include);
  const total = (key: "cost" | "fine" | "selling") => included.reduce((sum, row) => sum + toNumber(row[key]), 0);
  const profit = total("selling") - total("cost") - total("fine");
  const hasSuggestion = suggestedSelling && Object.values(suggestedSelling).some((value) => value != null);

  if (passengers.length === 0) {
    return <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-ink-secondary">This lead has no passengers yet — add them before quoting.</p>;
  }

  const input = (index: number, key: "cost" | "fine" | "selling", label: string) => (
    <label className="flex flex-col gap-1 text-xs text-ink-tertiary">
      <span className="sm:sr-only">{label}</span>
      <input
        type="number"
        min={0}
        step="0.01"
        inputMode="decimal"
        aria-label={`${label} for ${rows[index].fullName}`}
        disabled={!rows[index].include}
        value={rows[index][key]}
        onChange={(event) => update(index, { [key]: event.target.value })}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm disabled:opacity-50")}
      />
    </label>
  );

  return (
    <fieldset className="col-span-full flex flex-col gap-3 rounded-lg border border-hairline bg-surface-2 p-3">
      <legend className="px-1 text-sm font-semibold text-ink-heading">Cost per passenger</legend>
      <p className="text-xs text-ink-tertiary">
        Cost = what the vendor charges (internal). Profit = Selling − Cost − Fine; GST is charged on the profit only. Untick a passenger to
        leave them out of this quote.
      </p>
      <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))] gap-2 px-1 text-xs font-medium text-ink-secondary sm:grid">
        <span>Passenger</span>
        <span>Cost (₹)</span>
        <span>Fine (₹)</span>
        <span>Selling (₹)</span>
      </div>
      {rows.map((row, index) => (
        <div key={row.passengerId} className="grid grid-cols-1 items-center gap-2 rounded-md bg-surface-1 p-2 sm:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <label className="flex min-w-0 items-center gap-2 text-sm text-ink-primary">
            <input type="checkbox" checked={row.include} onChange={(event) => update(index, { include: event.target.checked })} className="h-4 w-4 accent-[var(--color-accent)]" />
            <span className="truncate">{row.fullName}</span>
          </label>
          {input(index, "cost", "Cost")}
          {input(index, "fine", "Fine")}
          {input(index, "selling", "Selling")}
        </div>
      ))}
      {hasSuggestion ? (
        <button
          type="button"
          onClick={() =>
            publish(
              rows.map((row) => {
                const suggested = suggestedSelling?.[row.passengerId];
                return suggested != null && row.selling.trim() === "" ? { ...row, selling: String(suggested) } : row;
              })
            )
          }
          className="self-start text-xs font-medium text-ink-accent underline-offset-4 hover:underline"
        >
          Fill empty selling amounts with the Admin rates
        </button>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 border-t border-hairline pt-2 text-sm">
        <span className="text-ink-tertiary">
          Cost <span className="font-medium text-ink-primary">{formatCurrency(total("cost"))}</span>
        </span>
        <span className="text-ink-tertiary">
          Fine <span className="font-medium text-ink-primary">{formatCurrency(total("fine"))}</span>
        </span>
        <span className="text-ink-tertiary">
          Selling <span className="font-semibold text-ink-heading">{formatCurrency(total("selling"))}</span>
        </span>
        <span className="text-ink-tertiary">
          Profit <span className={cn("font-semibold", profit < 0 ? "text-error" : "text-success")}>{formatCurrency(profit)}</span>
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
