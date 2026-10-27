"use client";

import { useFormContext } from "react-hook-form";
import type { FlightSpecialFareRequestValues } from "@/lib/validation/flight-special-fare-schema";
import { paxCountsLine, previewPaxTypeLabel } from "@/lib/special-fare/pax-summary";

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <span className="text-sm text-ink-tertiary">{label}</span>
      <span className="text-right text-sm font-medium text-ink-primary">{value}</span>
    </div>
  );
}

/**
 * Flight_Special_Fare.md §7: final review. Client doc 2026-10-27 (A2): trip
 * type + route, travel / return date, the passenger counts by type and each
 * passenger with DOB and computed Adult / Child / Infant type.
 */
export function Step3Summary() {
  const { getValues } = useFormContext<FlightSpecialFareRequestValues>();
  const values = getValues();
  const passengers = values.passengers.map((passenger) => ({
    ...passenger,
    type: previewPaxTypeLabel(passenger.dob, values.travelDate),
  }));
  const counts = paxCountsLine(passengers.map((p) => p.type));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <h3 className="pt-4 text-sm font-semibold text-ink-heading">Trip</h3>
        <SummaryRow label="Trip Type" value={values.returnDate ? "Return" : "One Way"} />
        <SummaryRow label="From" value={values.origin} />
        <SummaryRow label="To" value={values.destination} />
        <SummaryRow label="Travel Date" value={formatDate(values.travelDate)} />
        {values.returnDate ? <SummaryRow label="Return Date" value={formatDate(values.returnDate)} /> : null}
      </div>

      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <div className="flex items-center justify-between gap-4 pt-4">
          <h3 className="text-sm font-semibold text-ink-heading">Passengers</h3>
          {counts ? <span className="text-sm font-medium text-ink-accent">{counts}</span> : null}
        </div>
        {passengers.map((passenger, index) => (
          <SummaryRow
            key={`${passenger.fullName}-${index}`}
            label={`${index + 1}. ${passenger.fullName}`}
            value={[passenger.dob ? `DOB ${formatDate(passenger.dob)}` : "", passenger.type ?? ""].filter(Boolean).join(" · ")}
          />
        ))}
      </div>

      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <h3 className="pt-4 text-sm font-semibold text-ink-heading">Contact</h3>
        <SummaryRow label="Full Name" value={values.fullName} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
      </div>

      <p className="rounded-lg bg-surface-2 px-4 py-3 text-xs text-ink-tertiary">
        Passenger type is calculated automatically from date of birth — fare varies by type. Our team will confirm
        exact pricing and available flights before you pay anything.
      </p>
    </div>
  );
}
