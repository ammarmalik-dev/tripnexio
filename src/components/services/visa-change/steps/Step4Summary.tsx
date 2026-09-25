"use client";

import { useFormContext } from "react-hook-form";
import type { VisaChangeRequestValues } from "@/lib/validation/visa-change-schema";

const CHANGE_TYPE_LABEL: Record<VisaChangeRequestValues["changeType"], string> = {
  AIRPORT_TO_AIRPORT: "Airport to Airport",
  BORDER_EXIT: "Border Exit",
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

export function Step4Summary() {
  const { getValues } = useFormContext<VisaChangeRequestValues>();
  const values = getValues();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <SummaryRow label="Method" value={CHANGE_TYPE_LABEL[values.changeType]} />
        <SummaryRow label="Full Name" value={values.fullName} />
        <SummaryRow label="Passport Number" value={values.passportNumber} />
        <SummaryRow label="Visa Last Date" value={formatDate(values.visaLastDate)} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
        <SummaryRow label="Nationality" value={values.nationality} />
        {values.additionalPassengers.length > 0 ? (
          <SummaryRow label="Additional Passengers" value={String(values.additionalPassengers.length)} />
        ) : null}
      </div>
      <p className="rounded-lg bg-surface-2 px-4 py-3 text-xs text-ink-tertiary">
        Our team will check availability with the relevant sponsor/partner and confirm your options. Pricing is
        confirmed only after availability and package selection.
      </p>
    </div>
  );
}
