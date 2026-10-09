"use client";

import { useEffect } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { Skeleton } from "@/components/ui/Skeleton";
import { useWorkingCalendar } from "@/lib/calendar/use-working-calendar";
import { workingDaysBetween } from "@/lib/calendar/working-calendar";
import { allowedProcessingTypes } from "@/lib/new-visa/products";
import { useNewVisaTravelRules } from "@/lib/new-visa/use-travel-rules";
import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";
import { useProcessingTypes } from "@/lib/processing-types/use-processing-types";
import { ExpectedApprovalDate } from "../ExpectedApprovalDate";

/**
 * P10 — Normal needs the travel date at least N UAE working days away,
 * Express at least M (Admin → Timelines / SLA; 7 / 3 by default). A type
 * that can't meet the chosen date is shown but can't be picked, with the
 * reason. The server applies the same rule on submit.
 * P23 — the options and their labels come from the Admin Processing Types
 * master; a code Admin disabled isn't offered (and the server rejects it).
 */
export function Step2ProcessingType() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<NewVisaRequestValues>();
  const processingType = useWatch({ control, name: "processingType" });
  const travelDate = useWatch({ control, name: "travelDate" });
  const destinationCountry = useWatch({ control, name: "destinationCountry" });
  const calendar = useWorkingCalendar("UAE");
  // Client testing 2026-10-09 (B31) — the destination's own timeline.
  const rules = useNewVisaTravelRules(destinationCountry);

  const { state: optionsState, options: allMasterOptions } = useProcessingTypes("NEW_VISA");
  // The request schema stores only these codes; any other master code can't be submitted here.
  const masterOptions = allMasterOptions.filter((option) => option.code === "normal" || option.code === "urgent");
  const offeredCodes = masterOptions.map((option) => option.code);

  const workingDays = travelDate ? workingDaysBetween(travelDate, new Date(), calendar) : Number.POSITIVE_INFINITY;
  const allowed = allowedProcessingTypes(workingDays, rules).filter((code) => offeredCodes.includes(code));
  const allowedKey = allowed.join(",");

  // A choice made before the travel date changed may no longer be possible.
  useEffect(() => {
    if (optionsState === "loading") return;
    if (processingType && !allowedKey.split(",").includes(processingType)) {
      setValue("processingType", undefined as unknown as NewVisaRequestValues["processingType"]);
    }
  }, [allowedKey, optionsState, processingType, setValue]);

  const days = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

  if (optionsState === "loading") return <Skeleton className="h-40 w-full" />;
  const labelFor = (code: string) => masterOptions.find((option) => option.code === code)?.label ?? code;

  return (
    <div className="flex flex-col gap-3">
      <RadioCardGroup<NewVisaRequestValues>
        name="processingType"
        label="Processing Type"
        required
        register={register}
        selectedValue={processingType}
        error={errors.processingType?.message}
        options={masterOptions.map((option) => {
          const code = option.code as "normal" | "urgent";
          const isAllowed = allowed.includes(code);
          const minDays = code === "urgent" ? rules.minTravelDaysExpress : rules.minTravelDaysNormal;
          const defaultDescription =
            code === "urgent" ? "Expedited processing for time-sensitive travel." : "Standard processing timeline for your visa request.";
          return {
            value: option.code,
            label: option.label,
            description: isAllowed ? option.description || defaultDescription : `Needs your travel date at least ${days(minDays)} away.`,
            disabled: !isAllowed,
          };
        })}
      />
      {processingType && allowed.includes(processingType) ? (
        <ExpectedApprovalDate
          label={labelFor(processingType)}
          workingDays={processingType === "urgent" ? rules.processingDaysExpress : rules.processingDaysNormal}
          calendar={calendar}
        />
      ) : null}
      {allowed.length === 0 ? (
        <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          Your travel date is too close for us to process a visa in time. Please choose a later travel date, or message
          us on WhatsApp and our team will check what&apos;s possible.
        </p>
      ) : allowed.length === 1 ? (
        <p className="text-xs text-ink-tertiary">Only {labelFor(allowed[0])} processing can meet your travel date.</p>
      ) : null}
    </div>
  );
}
