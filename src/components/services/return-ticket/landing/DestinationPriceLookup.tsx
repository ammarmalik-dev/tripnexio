"use client";

import { useState } from "react";
import { SelectField } from "@/components/forms/SelectField";
import { formatCurrency } from "@/lib/format-currency";
import type { ReturnTicketLandingDestination } from "./CancellationRefundSection";

/**
 * Client correction 2026-10-05: no fixed price table on the page. The customer
 * picks a destination and sees only that destination's Admin-set price and
 * cancellation fee.
 */
export function DestinationPriceLookup({ destinations }: { destinations: ReturnTicketLandingDestination[] }) {
  const [selected, setSelected] = useState("");
  const destination = destinations.find((row) => row.countryName === selected);

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        name="rvt-price-destination"
        label="Destination country"
        placeholder="Select a destination"
        options={destinations.map((row) => ({ value: row.countryName, label: row.countryName }))}
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
      />
      {destination ? (
        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-hairline bg-surface-1 p-4" aria-live="polite">
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-ink-tertiary uppercase">Price per passenger</dt>
            <dd className="text-lg font-semibold text-ink-heading">{formatCurrency(destination.ratePerApplicant)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-ink-tertiary uppercase">Cancellation fee</dt>
            <dd className="text-lg font-semibold text-ink-heading">
              {destination.cancellationFee === null ? "None" : formatCurrency(destination.cancellationFee)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-ink-secondary">Select your destination to see the applicable price.</p>
      )}
    </div>
  );
}
