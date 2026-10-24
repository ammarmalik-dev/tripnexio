"use client";

import { useState } from "react";
import { SelectField } from "@/components/forms/SelectField";
import { formatCurrency } from "@/lib/format-currency";
import type { ReturnTicketLandingDestination } from "./CancellationRefundSection";

/**
 * Client correction 2026-10-05: no fixed price table on the page. The customer
 * picks a destination and sees only that destination's Admin-set price and
 * cancellation fee. The labels are the page's Admin → Website Pages wording (plain strings: client component).
 */
export interface DestinationPriceLookupLabels {
  select: string;
  placeholder: string;
  prompt: string;
  price: string;
  fee: string;
  noFee: string;
}

export function DestinationPriceLookup({
  destinations,
  labels,
}: {
  destinations: ReturnTicketLandingDestination[];
  labels: DestinationPriceLookupLabels;
}) {
  const [selected, setSelected] = useState("");
  const destination = destinations.find((row) => row.countryName === selected);

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        name="rvt-price-destination"
        label={labels.select}
        placeholder={labels.placeholder}
        options={destinations.map((row) => ({ value: row.countryName, label: row.countryName }))}
        value={selected}
        onChange={(event) => setSelected(event.target.value)}
      />
      {destination ? (
        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-hairline bg-surface-1 p-4" aria-live="polite">
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-ink-tertiary uppercase">{labels.price}</dt>
            <dd className="text-lg font-semibold text-ink-heading">{formatCurrency(destination.ratePerApplicant)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-ink-tertiary uppercase">{labels.fee}</dt>
            <dd className="text-lg font-semibold text-ink-heading">
              {destination.cancellationFee === null ? labels.noFee : formatCurrency(destination.cancellationFee)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-ink-secondary">{labels.prompt}</p>
      )}
    </div>
  );
}
