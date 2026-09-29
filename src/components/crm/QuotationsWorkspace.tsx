"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { QuotationsTable } from "./QuotationsTable";
import { AwaitingQuotationsTable } from "./AwaitingQuotationsTable";
import { cn } from "@/lib/cn";

type Tab = "all" | "awaiting";

const TABS: { value: Tab; label: string }[] = [
  { value: "awaiting", label: "Awaiting quotation" },
  { value: "all", label: "All quotations" },
];

/**
 * /crm/quotations — "Awaiting quotation" (P21: Special Fare / Visa
 * Extension / Visa Change leads with no quote yet) alongside the existing
 * all-quotations list. `?tab=awaiting` deep-links to the queue; any other
 * existing filter link (e.g. a Command Centre card's `?status=`) keeps
 * landing on the list it always did.
 */
export function QuotationsWorkspace() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (searchParams.get("tab") === "awaiting" ? "awaiting" : "all"));

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Quotation views" className="flex gap-1 border-b border-hairline">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={`quotations-tab-${option.value}`}
            aria-selected={tab === option.value}
            aria-controls={`quotations-panel-${option.value}`}
            onClick={() => setTab(option.value)}
            className={cn(
              "-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              tab === option.value
                ? "border-accent text-ink-heading"
                : "border-transparent text-ink-tertiary hover:text-ink-secondary"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`quotations-panel-${tab}`} aria-labelledby={`quotations-tab-${tab}`}>
        {tab === "awaiting" ? <AwaitingQuotationsTable /> : <QuotationsTable />}
      </div>
    </div>
  );
}
