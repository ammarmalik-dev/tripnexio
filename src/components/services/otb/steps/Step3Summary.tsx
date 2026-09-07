"use client";

import { useFormContext } from "react-hook-form";
import { SAMPLE_AIRLINE_OPTIONS } from "@/lib/sample-data";
import { PassportUploadField } from "@/components/forms/PassportUploadField";
import type { OtbRequestValues } from "@/lib/validation/otb-schema";

const processingTypeLabel: Record<OtbRequestValues["processingType"], string> = {
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
  const { getValues } = useFormContext<OtbRequestValues>();
  const values = getValues();
  const airlineLabel =
    SAMPLE_AIRLINE_OPTIONS.find((option) => option.value === values.airline)?.label ?? values.airline;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <SummaryRow label="Full Name" value={values.fullName} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
        <SummaryRow label="Airline" value={airlineLabel} />
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
      <PassportUploadField base64FieldName="passportImageBase64" mimeFieldName="passportImageMimeType" />
    </div>
  );
}
