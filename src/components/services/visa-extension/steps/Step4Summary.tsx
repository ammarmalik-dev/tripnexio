"use client";

import { useFormContext } from "react-hook-form";
import type { VisaExtensionRequestValues } from "@/lib/validation/visa-extension-schema";

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
  const { getValues } = useFormContext<VisaExtensionRequestValues>();
  const values = getValues();

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <SummaryRow label="Full Name" value={values.fullName} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
        <SummaryRow label="Passport Number" value={values.passportNumber} />
        <SummaryRow label="Date of Birth" value={formatDate(values.dob)} />
        <SummaryRow label="Currently Inside UAE" value={values.insideUAE === "yes" ? "Yes" : "No"} />
        <SummaryRow label="UAE Entry Date" value={formatDate(values.entryDate)} />
        <SummaryRow label="Passport Copy" value={values.passportImageBase64 ? "Uploaded" : "Missing"} />
      </div>
      {values.additionalApplicants.map((applicant, index) => (
        <div key={index} className="rounded-xl border border-hairline bg-surface-1 px-5">
          <p className="pt-3 text-xs font-medium uppercase tracking-wide text-ink-accent">
            Applicant {index + 2}
          </p>
          <SummaryRow label="Full Name" value={applicant.fullName} />
          <SummaryRow label="Passport Number" value={applicant.passportNumber} />
          <SummaryRow label="Date of Birth" value={formatDate(applicant.dob)} />
          <SummaryRow label="UAE Entry Date" value={formatDate(applicant.entryDate)} />
          <SummaryRow label="Passport Copy" value={applicant.passportImageBase64 ? "Uploaded" : "Missing"} />
        </div>
      ))}
      <p className="rounded-lg bg-surface-2 px-4 py-3 text-xs text-ink-tertiary">
        We currently offer Visa Extension only for visas originally issued through TripNexio. We&apos;ll check your
        details and confirm your eligibility before any fee is calculated.
      </p>
    </div>
  );
}
