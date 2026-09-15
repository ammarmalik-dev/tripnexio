"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { getJson } from "@/lib/api/client";

/**
 * CRM Quote Builder's Protection Plan "reflect it" requirement (Step 20,
 * audit §7.1, roadmap prompt) — informational only at the quote stage,
 * since Protection Plan is fundamentally per-BookingPassenger and no
 * BookingPassenger rows exist yet until a Booking is created. The real
 * interactive purchase flow lives on the Booking detail page
 * (ProtectionPlanControl.tsx), where every New Visa booking's passengers
 * are pre-offered a plan automatically.
 */
export function ProtectionPlanNote() {
  const [price, setPrice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<{ defaultPrice: string }>("/api/protection-plan-config")
      .then((config) => {
        if (!cancelled) setPrice(config.defaultPrice);
      })
      .catch(() => {
        // Non-critical — this is an informational note only.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!price) return null;

  return (
    <div className="mb-3 flex items-center gap-2 rounded-lg bg-accent/5 px-3 py-2 text-xs text-ink-secondary">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-ink-accent" aria-hidden="true" />
      Protection Plan (₹{price}/eligible passenger) will be offered to each passenger once this lead becomes a booking — manage it from the
      booking&apos;s Passengers section.
    </div>
  );
}
