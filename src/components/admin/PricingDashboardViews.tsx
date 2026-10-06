"use client";

import { useState } from "react";
import { PricingCountryCards } from "./PricingCountryCards";
import { PricingDashboard } from "./PricingDashboard";
import { cn } from "@/lib/cn";

const VIEWS = [
  { id: "countries", label: "By country" },
  { id: "table", label: "All prices (table)" },
] as const;

/** Client corrections 2026-10-05 §31 — country cards by default; the filterable table stays one click away. */
export function PricingDashboardViews() {
  const [view, setView] = useState<(typeof VIEWS)[number]["id"]>("countries");
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Pricing views" className="glass-1 flex w-fit gap-1 rounded-xl p-1">
        {VIEWS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={view === option.id}
            onClick={() => setView(option.id)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
              view === option.id ? "bg-surface-1 text-ink-heading shadow-[var(--shadow-glass-1)] ring-1 ring-glass-border" : "text-ink-secondary hover:text-ink-primary"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {view === "countries" ? <PricingCountryCards /> : <PricingDashboard />}
    </div>
  );
}
