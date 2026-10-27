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

function SummaryCard({ title, aside, children }: { title: string; aside?: string | null; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-1 px-5">
      <div className="flex items-center justify-between gap-4 pt-4">
        <h3 className="text-sm font-semibold text-ink-heading">{title}</h3>
        {aside ? <span className="text-sm font-medium text-ink-accent">{aside}</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * Flight_Special_Fare.md §7: final review. Client doc 2026-10-27 (A2) + client reply 2026-10-27: four parts —
 * Trip details, Flight details, Pax info (each passenger with DOB and the computed Adult / Child / Infant type,
 * then the contact person) and Fare info (passengers per fare type; the fare itself comes in the quotation).
 */
export function Step3Summary() {
  const { getValues } = useFormContext<FlightSpecialFareRequestValues>();
  const values = getValues();
  const passengers = values.passengers.map((passenger) => ({
    ...passenger,
    type: previewPaxTypeLabel(passenger.dob, values.travelDate),
  }));
  const counts = paxCountsLine(passengers.map((p) => p.type));
  const fareTypes = (["Adult", "Child", "Infant"] as const)
    .map((type) => ({ type, count: passengers.filter((passenger) => passenger.type === type).length }))
    .filter((row) => row.count > 0);

  return (
    <div className="flex flex-col gap-4">
      <SummaryCard title="Trip Details">
        <SummaryRow label="Trip Type" value={values.returnDate ? "Return" : "One Way"} />
        <SummaryRow label="Travel Date" value={formatDate(values.travelDate)} />
        {values.returnDate ? <SummaryRow label="Return Date" value={formatDate(values.returnDate)} /> : null}
        <SummaryRow label="Passengers" value={counts || String(passengers.length)} />
      </SummaryCard>

      <SummaryCard title="Flight Details">
        <SummaryRow label="Departure" value={values.origin} />
        <SummaryRow label="Arrival" value={values.destination} />
        {values.returnDate ? <SummaryRow label="Return" value={`${values.destination} → ${values.origin}`} /> : null}
      </SummaryCard>

      <SummaryCard title="Pax Info" aside={counts}>
        {passengers.map((passenger, index) => (
          <SummaryRow
            key={`${passenger.fullName}-${index}`}
            label={`${index + 1}. ${passenger.fullName}`}
            value={[passenger.dob ? `DOB ${formatDate(passenger.dob)}` : "", passenger.type ?? ""].filter(Boolean).join(" · ")}
          />
        ))}
        <SummaryRow label="Contact Name" value={values.fullName} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
      </SummaryCard>

      <SummaryCard title="Fare Info">
        {fareTypes.map((row) => (
          <SummaryRow key={row.type} label={`${row.type} × ${row.count}`} value="Fare shared in your quotation" />
        ))}
        <p className="border-t border-hairline py-3 text-xs text-ink-tertiary">
          Passenger type is calculated automatically from date of birth — fare varies by type. Our team will confirm
          exact pricing and available flights before you pay anything.
        </p>
      </SummaryCard>
    </div>
  );
}
