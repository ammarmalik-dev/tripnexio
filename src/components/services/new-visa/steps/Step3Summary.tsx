"use client";

import { useFormContext } from "react-hook-form";
import { DESTINATION_COUNTRY_OPTIONS, SAMPLE_VISA_TYPE_OPTIONS } from "@/lib/sample-data";
import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";

const processingTypeLabel: Record<NewVisaRequestValues["processingType"], string> = {
  normal: "Normal",
  urgent: "Urgent",
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-hairline py-3 last:border-b-0">
      <span className="text-sm text-ink-tertiary">{label}</span>
      <span className="text-sm font-medium text-ink-primary">{value}</span>
    </div>
  );
}

export function Step3Summary() {
  const { getValues } = useFormContext<NewVisaRequestValues>();
  const values = getValues();
  const destinationLabel =
    DESTINATION_COUNTRY_OPTIONS.find((option) => option.value === values.destinationCountry)?.label ??
    values.destinationCountry;
  const visaTypeLabel =
    SAMPLE_VISA_TYPE_OPTIONS.find((option) => option.value === values.visaType)?.label ?? values.visaType;

  return (
    <div className="rounded-xl border border-hairline bg-surface-1 px-5">
      <SummaryRow label="Full Name" value={values.fullName} />
      <SummaryRow label="Mobile Number" value={values.mobile} />
      <SummaryRow label="Email" value={values.email} />
      <SummaryRow label="Destination Country" value={destinationLabel} />
      <SummaryRow label="Visa Type" value={visaTypeLabel} />
      <SummaryRow label="Number of Travelers" value={String(values.travelers)} />
      <SummaryRow
        label="Travel Date"
        value={
          values.travelDate
            ? new Date(values.travelDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : ""
        }
      />
      <SummaryRow label="Processing Type" value={processingTypeLabel[values.processingType]} />
    </div>
  );
}
