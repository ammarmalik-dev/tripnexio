"use client";

import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Skeleton } from "@/components/ui/Skeleton";
import { evaluateOtbTravelDate } from "@/lib/otb/processing-rules";
import { formatOtbRupees, useOtbAirlines } from "@/lib/otb/use-otb-airlines";
import { siteConfig } from "@/lib/site-config";
import type { OtbRequestValues } from "@/lib/validation/otb-schema";

/**
 * Client rule: a travel date inside the airline's standard processing time
 * (default 24 working days, Admin-configurable) offers/forces Urgent when
 * the airline has it, and otherwise stops the request with an explanation.
 */
export function Step2ProcessingType() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<OtbRequestValues>();
  const processingType = useWatch({ control, name: "processingType" });
  const airlineCode = useWatch({ control, name: "airline" });
  const travelDate = useWatch({ control, name: "travelDate" });
  const applicants = (useWatch({ control, name: "additionalApplicants" }) ?? []).length + 1;
  const { state, airlines } = useOtbAirlines();

  const airline = airlines.find((a) => a.code === airlineCode);
  const outcome = airline ? evaluateOtbTravelDate(travelDate, airline) : null;

  // A previously chosen type may no longer be valid after the airline/date changed.
  const allowedKey = outcome?.allowed.join(",") ?? "";
  useEffect(() => {
    if (processingType && !allowedKey.split(",").includes(processingType)) {
      setValue("processingType", undefined as unknown as OtbRequestValues["processingType"]);
    }
  }, [allowedKey, processingType, setValue]);

  if (state === "loading") return <Skeleton className="h-40 w-full" />;
  if (!airline || !outcome) return <p className="text-sm text-ink-secondary">Go back and choose an airline first.</p>;

  const priceNote = (price: number | null) => (price === null ? "" : ` ${formatOtbRupees(price)} per applicant.`);
  const options = [
    {
      value: "normal",
      label: "Normal",
      description: `Standard processing (${airline.standardDays} working days).${priceNote(airline.normalPrice)}`,
    },
    {
      value: "urgent",
      label: "Urgent",
      description: `Expedited processing for time-sensitive travel.${priceNote(airline.urgentPrice)}`,
    },
  ].filter((option) => outcome.allowed.includes(option.value as "normal" | "urgent"));

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
        <ButtonLink href={siteConfig.contact.whatsappHref}>WhatsApp Support</ButtonLink>
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
