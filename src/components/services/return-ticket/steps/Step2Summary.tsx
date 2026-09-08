"use client";

import { useFormContext } from "react-hook-form";
import type { ReturnTicketRequestValues } from "@/lib/validation/return-ticket-schema";

const VISA_TYPE_LABEL: Record<ReturnTicketRequestValues["visaType"], string> = {
  THIRTY_DAYS: "30 Days",
  SIXTY_DAYS: "60 Days",
};

function formatDate(value: string): string {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "";
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <span className="text-sm text-ink-tertiary">{label}</span>
      <span className="text-sm font-medium text-ink-primary">{value}</span>
    </div>
  );
}

/**
 * Return_Verified_Ticket.md §12, locked: before payment the customer sees
 * "Service summary, Passenger count, Visa type, Travel date, Applicable
 * price... Cancellation/refund policy, Airline/immigration disclaimer" —
 * notably NOT a return/onward date; §12's field list has no such entry,
 * consistent with §6/§7 keeping that value an internal, staff-side
 * calculation. This step deliberately does not preview it.
 */
export function Step2Summary() {
  const { getValues } = useFormContext<ReturnTicketRequestValues>();
  const values = getValues();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <SummaryRow label="Full Name" value={values.fullName} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
        <SummaryRow label="Number of Passengers" value={values.travelers} />
        <SummaryRow label="Visa Type" value={VISA_TYPE_LABEL[values.visaType]} />
        <SummaryRow label="Travel Date" value={formatDate(values.travelDate)} />
      </div>
      <p className="rounded-lg bg-surface-2 px-4 py-3 text-xs text-ink-tertiary">
        Return/onward reservations are provided according to the selected travel details and configured vendor
        availability. Airline schedules, immigration decisions, denied boarding, cancellations, rescheduling and
        other travel decisions remain outside TripNexio&rsquo;s control. Customers are responsible for complying
        with applicable airline, visa and immigration requirements. Our team will confirm final pricing before
        payment.
      </p>
    </div>
  );
}
