"use client";

import { useFormContext } from "react-hook-form";
import { RETURN_TICKET_VISA_TYPE_LABELS } from "@/lib/leads/compute-return-date";
import { formatRupees, useReturnTicketDestinations } from "@/lib/return-ticket/use-return-ticket-destinations";
import type { ReturnTicketRequestValues } from "@/lib/validation/return-ticket-schema";

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
 * Return_Verified_Ticket.md §12: service summary, passenger count, visa
 * validity, travel date, applicable price, disclaimer — and deliberately NOT
 * a return/onward date (an internal, staff-side calculation, §6/§7).
 */
export function Step3Summary() {
  const { getValues } = useFormContext<ReturnTicketRequestValues>();
  const values = getValues();
  const { destinations } = useReturnTicketDestinations();
  const destination = destinations.find((d) => d.countryId === values.destinationCountryId);
  const applicantCount = 1 + values.additionalApplicants.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <SummaryRow label="Full Name" value={values.fullName} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
        <SummaryRow label="Passport Number" value={values.passportNumber} />
        <SummaryRow label="Destination" value={destination?.countryName ?? ""} />
        <SummaryRow label="Visa Validity" value={RETURN_TICKET_VISA_TYPE_LABELS[values.visaType]} />
        <SummaryRow label="Travel Date" value={formatDate(values.travelDate)} />
        <SummaryRow label="Applicants" value={String(applicantCount)} />
        {destination ? (
          <SummaryRow
            label="Price"
            value={`${formatRupees(destination.ratePerApplicant)} × ${applicantCount} = ${formatRupees(
              destination.ratePerApplicant * applicantCount
            )}`}
          />
        ) : null}
      </div>
      {values.additionalApplicants.map((applicant, index) => (
        <div key={index} className="rounded-xl border border-hairline bg-surface-1 px-5">
          <p className="pt-3 text-xs font-medium uppercase tracking-wide text-ink-accent">Applicant {index + 2}</p>
          <SummaryRow label="Full Name" value={applicant.fullName} />
          <SummaryRow label="Passport Number" value={applicant.passportNumber} />
        </div>
      ))}
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
