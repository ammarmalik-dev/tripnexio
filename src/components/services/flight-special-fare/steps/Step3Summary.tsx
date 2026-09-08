"use client";

import { useFormContext } from "react-hook-form";
import type { FlightSpecialFareRequestValues } from "@/lib/validation/flight-special-fare-schema";

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
}

function previewPaxType(dob: string, travelDate: string): "Adult" | "Child" | "Infant" | "" {
  if (!dob || !travelDate) return "";
  const dobDate = new Date(dob);
  const travel = new Date(travelDate);
  if (Number.isNaN(dobDate.getTime()) || Number.isNaN(travel.getTime())) return "";

  let age = travel.getFullYear() - dobDate.getFullYear();
  const monthDiff = travel.getMonth() - dobDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && travel.getDate() < dobDate.getDate())) age--;

  if (age < 2) return "Infant";
  if (age < 12) return "Child";
  return "Adult";
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <span className="text-sm text-ink-tertiary">{label}</span>
      <span className="text-sm font-medium text-ink-primary">{value}</span>
    </div>
  );
}

/** Flight_Special_Fare.md §7: final review, including the computed Adult/Child/Infant type per passenger. */
export function Step3Summary() {
  const { getValues } = useFormContext<FlightSpecialFareRequestValues>();
  const values = getValues();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <SummaryRow label="Full Name" value={values.fullName} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
        <SummaryRow label="Departure" value={values.origin} />
        <SummaryRow label="Arrival" value={values.destination} />
        <SummaryRow label="Travel Date" value={formatDate(values.travelDate)} />
        {values.returnDate ? <SummaryRow label="Return Date" value={formatDate(values.returnDate)} /> : null}
      </div>

      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        {values.passengers.map((passenger, index) => {
          const type = previewPaxType(passenger.dob, values.travelDate);
          return (
            <SummaryRow
              key={`${passenger.fullName}-${index}`}
              label={`Passenger ${index + 1}`}
              value={`${passenger.fullName}${type ? ` (${type})` : ""}`}
            />
          );
        })}
      </div>

      <p className="rounded-lg bg-surface-2 px-4 py-3 text-xs text-ink-tertiary">
        Fares vary by passenger type and change frequently — our team will confirm exact pricing and available
        flights before you pay anything.
      </p>
    </div>
  );
}
