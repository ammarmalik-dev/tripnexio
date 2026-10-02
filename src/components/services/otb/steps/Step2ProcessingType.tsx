"use client";

import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { evaluateOtbTravelDate } from "@/lib/otb/processing-rules";
import { useWorkingCalendar } from "@/lib/calendar/use-working-calendar";
import { formatOtbRupees, otbApplicantPrice, useOtbAirlines } from "@/lib/otb/use-otb-airlines";
import { useSiteContact } from "@/components/layout/SiteContactProvider";
import type { OtbRequestValues } from "@/lib/validation/otb-schema";
import { useProcessingTypes } from "@/lib/processing-types/use-processing-types";

/**
 * Client rule: a travel date inside the airline's standard processing time
 * (default 2 working days, Admin-configurable) offers/forces Urgent when
 * the airline has it, and otherwise stops the request with an explanation.
 * P23 — option labels come from the Admin Processing Types master; a code
 * Admin disabled isn't offered (and the server rejects it).
 */
export function Step2ProcessingType() {
  const contact = useSiteContact();
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<OtbRequestValues>();
  const processingType = useWatch({ control, name: "processingType" });
  const airlineCode = useWatch({ control, name: "airline" });
  const travelDate = useWatch({ control, name: "travelDate" });
  const destinationCountry = useWatch({ control, name: "destinationCountry" });
  const paxType = useWatch({ control, name: "paxType" });
  const applicants = (useWatch({ control, name: "additionalApplicants" }) ?? []).length + 1;
  const { state, airlines } = useOtbAirlines();
  const calendar = useWorkingCalendar("INDIA");
  const { state: optionsState, options: masterOptions } = useProcessingTypes("OTB");
  const offeredCodes = masterOptions.map((option) => option.code);

  const airline = airlines.find((a) => a.code === airlineCode);
  const outcome = airline ? evaluateOtbTravelDate(travelDate, airline, new Date(), calendar) : null;

  // A previously chosen type may no longer be valid after the airline/date changed.
  const allowedCodes = (outcome?.allowed ?? []).filter((code) => offeredCodes.includes(code));
  const allowedKey = allowedCodes.join(",");
  useEffect(() => {
    if (optionsState === "loading") return;
    if (processingType && !allowedKey.split(",").includes(processingType)) {
      setValue("processingType", undefined as unknown as OtbRequestValues["processingType"]);
    }
  }, [allowedKey, optionsState, processingType, setValue]);

  if (state === "loading" || optionsState === "loading") return <Skeleton className="h-40 w-full" />;
  if (!airline || !outcome) return <p className="text-sm text-ink-secondary">Go back and choose an airline first.</p>;

  const priceNote = (price: number | null) => (price === null ? "" : ` ${formatOtbRupees(price)} per applicant.`);
  const options = masterOptions
    .filter((option) => allowedCodes.some((code) => code === option.code))
    .map((option) => ({
      value: option.code,
      label: option.label,
      description:
        option.code === "urgent"
          ? `${option.description || "Expedited processing for time-sensitive travel."}${priceNote(otbApplicantPrice(airline, destinationCountry ?? "", paxType, "urgent"))}`
          : `${option.description || `Standard processing (${airline.standardDays} working days).`}${priceNote(otbApplicantPrice(airline, destinationCountry ?? "", paxType, "normal"))}`,
    }));

  return (
    <div className="flex flex-col gap-4">
      {outcome.message ? (
        <div
          role="alert"
          className={
            outcome.status === "BLOCKED"
              ? "flex gap-3 rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-ink-secondary"
              : "flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm text-ink-secondary"
          }
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{outcome.message}</span>
        </div>
      ) : null}

      {outcome.status === "BLOCKED" ? (
        <ButtonLink href={contact.whatsappHref}>WhatsApp Support</ButtonLink>
      ) : (
        <>
          <RadioCardGroup<OtbRequestValues>
            name="processingType"
            label="Processing Type"
            required
            register={register}
            selectedValue={processingType}
            error={errors.processingType?.message}
            options={options}
          />
          <p className="text-xs text-ink-tertiary">Applicants: {applicants}. Final pricing is confirmed by our team.</p>
        </>
      )}
    </div>
  );
}
