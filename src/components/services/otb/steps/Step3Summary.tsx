"use client";

import { useFormContext } from "react-hook-form";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { formatOtbRupees, otbApplicantPrice, useOtbAirlines } from "@/lib/otb/use-otb-airlines";
import { SelectField } from "@/components/forms/SelectField";
import { DateField } from "@/components/forms/DateField";
import { formatRupees, useReturnTicketDestinations } from "@/lib/return-ticket/use-return-ticket-destinations";
import { useDestinationCountryOptions } from "@/lib/use-destination-countries";
import type { OtbRequestValues } from "@/lib/validation/otb-schema";
import { useProcessingTypes } from "@/lib/processing-types/use-processing-types";
import { processingTypeLabel } from "@/lib/processing-types/defaults";


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
  const destinationCountryOptions = useDestinationCountryOptions();
  const destinationCountryLabel =
    destinationCountryOptions.find((option) => option.value === values.destinationCountry)?.label ??
    values.destinationCountry;
  // P23 — label from the Admin Processing Types master (stored code unchanged).
  const { options: processingTypeOptions } = useProcessingTypes("OTB");
  const applicantCount = 1 + values.additionalApplicants.length;
  // P18 — priced per applicant (airline + destination + passenger type).
  const applicantPrices = airline
    ? [values.paxType, ...values.additionalApplicants.map((a) => a.paxType)].map((paxType) =>
        otbApplicantPrice(airline, values.destinationCountry, paxType, values.processingType)
      )
    : [];
  const otbTotal = applicantPrices.length && applicantPrices.every((p) => p !== null) ? applicantPrices.reduce<number>((sum, p) => sum + (p ?? 0), 0) : null;
  const hasReturnTicket = watch("hasReturnTicket");
  const addReturnTicket = watch("addReturnTicket");
  const returnDestinationCountryId = watch("returnDestinationCountryId");
  const { destinations } = useReturnTicketDestinations();
  const returnDestination = destinations.find((d) => d.countryId === returnDestinationCountryId);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-hairline bg-surface-1 px-5">
        <SummaryRow label="Full Name" value={values.fullName} />
        <SummaryRow label="Mobile Number" value={values.mobile} />
        <SummaryRow label="Email" value={values.email} />
        <SummaryRow label="Destination Country" value={destinationCountryLabel} />
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
        <SummaryRow label="Processing Type" value={processingTypeLabel("OTB", values.processingType, processingTypeOptions)} />
        <SummaryRow label="Applicants" value={String(applicantCount)} />
        {otbTotal !== null ? (
          <SummaryRow
            label="Indicative OTB price"
            value={
              applicantPrices.every((p) => p === applicantPrices[0])
                ? `${formatOtbRupees(applicantPrices[0] ?? 0)} × ${applicantCount} = ${formatOtbRupees(otbTotal)}`
                : `${applicantPrices.map((p) => formatOtbRupees(p ?? 0)).join(" + ")} = ${formatOtbRupees(otbTotal)}`
            }
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
        <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
          <RadioCardGroup<OtbRequestValues>
            name="addReturnTicket"
            label="Add a Return Verified Ticket to this order?"
            register={register}
            selectedValue={addReturnTicket}
            error={errors.addReturnTicket?.message}
            options={[
              { value: "yes", label: "Yes, add it", description: `Destination rate × ${applicantCount} applicant${applicantCount > 1 ? "s" : ""}, paid separately.` },
              { value: "no", label: "Not now", description: "Our team will follow up with you." },
            ]}
          />
          {addReturnTicket === "yes" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField
                label="Return ticket destination"
                required
                placeholder="Select a destination"
                options={destinations.map((d) => ({ value: d.countryId, label: d.countryName }))}
                error={errors.returnDestinationCountryId?.message}
                {...register("returnDestinationCountryId")}
              />
              <DateField
                label="Expected return date"
                required
                min={values.travelDate || undefined}
                hint="We aim to issue close to this date, subject to availability."
                error={errors.expectedReturnDate?.message}
                {...register("expectedReturnDate")}
              />
              {returnDestination ? (
                <p className="text-sm text-ink-secondary sm:col-span-2">
                  Return Verified Ticket: {formatRupees(returnDestination.ratePerApplicant)} × {applicantCount} ={" "}
                  <strong>{formatRupees(returnDestination.ratePerApplicant * applicantCount)}</strong>
                  {returnDestination.cancellationFee !== null && returnDestination.cancellationFee > 0
                    ? ` · cancellation fee ${formatRupees(returnDestination.cancellationFee)} before forwarding`
                    : ""}
                  . It&apos;s issued only after your OTB is approved.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-ink-secondary">
              OTB needs a return ticket. You can still submit — our team will follow up and can arrange a{" "}
              <a className="text-ink-accent underline" href="/services/return-ticket">
                Return Verified Ticket
              </a>{" "}
              for you at the applicable rate.
            </p>
          )}
        </div>
      ) : null}
      <p className="text-xs text-ink-tertiary">Passport, visa and ticket copies are uploaded after payment.</p>
    </div>
  );
}
