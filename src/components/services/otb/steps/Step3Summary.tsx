"use client";

import { useFormContext } from "react-hook-form";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { formatOtbRupees, useOtbAirlines } from "@/lib/otb/use-otb-airlines";
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
  const {
    getValues,
    register,
    watch,
    formState: { errors },
  } = useFormContext<OtbRequestValues>();
  const values = getValues();
  const { airlines } = useOtbAirlines();
  const airline = airlines.find((a) => a.code === values.airline);
  const airlineLabel = airline?.name ?? values.airline;
  const applicantCount = 1 + values.additionalApplicants.length;
  const unitPrice = airline ? (values.processingType === "urgent" ? airline.urgentPrice : airline.normalPrice) : null;
  const hasReturnTicket = watch("hasReturnTicket");

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
        <SummaryRow label="Passport Number" value={values.passportNumber} />
        <SummaryRow label="Processing Type" value={processingTypeLabel[values.processingType]} />
        <SummaryRow label="Applicants" value={String(applicantCount)} />
        {unitPrice !== null ? (
          <SummaryRow
            label="Indicative price"
            value={`${formatOtbRupees(unitPrice)} × ${applicantCount} = ${formatOtbRupees(unitPrice * applicantCount)}`}
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
      <RadioCardGroup<OtbRequestValues>
        name="hasReturnTicket"
        label="Do you have a return ticket?"
        required
        register={register}
        selectedValue={hasReturnTicket}
        error={errors.hasReturnTicket?.message}
        options={[
          { value: "yes", label: "Yes", description: "I already have a return ticket." },
          { value: "no", label: "No", description: "I need one." },
        ]}
      />
      {hasReturnTicket === "no" ? (
        <p className="rounded-lg bg-surface-2 px-4 py-3 text-xs text-ink-secondary">
          OTB needs a return ticket. You can still submit — our team will follow up and can arrange a{" "}
          <a className="text-ink-accent underline" href="/services/return-ticket">
            Return Verified Ticket
          </a>{" "}
          for you at the applicable rate.
        </p>
      ) : null}
      <PassportUploadField base64FieldName="passportImageBase64" mimeFieldName="passportImageMimeType" />
    </div>
  );
}
