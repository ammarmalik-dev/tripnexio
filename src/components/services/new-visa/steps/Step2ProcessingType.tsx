"use client";

import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { getJson } from "@/lib/api/client";
import { useWorkingCalendar } from "@/lib/calendar/use-working-calendar";
import { workingDaysBetween } from "@/lib/calendar/working-calendar";
import { allowedProcessingTypes, DEFAULT_MIN_TRAVEL_DAYS, type NewVisaTravelRules } from "@/lib/new-visa/products";
import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";

/**
 * P10 — Normal needs the travel date at least N UAE working days away,
 * Express at least M (Admin → Timelines / SLA; 7 / 3 by default). A type
 * that can't meet the chosen date is shown but can't be picked, with the
 * reason. The server applies the same rule on submit.
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
  const calendar = useWorkingCalendar("UAE");
  const [rules, setRules] = useState<NewVisaTravelRules>({
    minTravelDaysNormal: DEFAULT_MIN_TRAVEL_DAYS.normal,
    minTravelDaysExpress: DEFAULT_MIN_TRAVEL_DAYS.urgent,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<NewVisaTravelRules>("/api/new-visa-rules");
        if (!cancelled) setRules(result);
      } catch {
        // Keep the defaults — the server re-checks on submit.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const workingDays = travelDate ? workingDaysBetween(travelDate, new Date(), calendar) : Number.POSITIVE_INFINITY;
  const allowed = allowedProcessingTypes(workingDays, rules);
  const allowedKey = allowed.join(",");

  // A choice made before the travel date changed may no longer be possible.
  useEffect(() => {
    if (processingType && !allowedKey.split(",").includes(processingType)) {
      setValue("processingType", undefined as unknown as NewVisaRequestValues["processingType"]);
    }
  }, [allowedKey, processingType, setValue]);

  const days = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-3">
      <RadioCardGroup<NewVisaRequestValues>
        name="processingType"
        label="Processing Type"
        required
        register={register}
        selectedValue={processingType}
        error={errors.processingType?.message}
        options={[
          {
            value: "normal",
            label: "Normal",
            description: allowed.includes("normal")
              ? "Standard processing timeline for your visa request."
              : `Needs your travel date at least ${days(rules.minTravelDaysNormal)} away.`,
            disabled: !allowed.includes("normal"),
          },
          {
            value: "urgent",
            label: "Express",
            description: allowed.includes("urgent")
              ? "Expedited processing for time-sensitive travel."
              : `Needs your travel date at least ${days(rules.minTravelDaysExpress)} away.`,
            disabled: !allowed.includes("urgent"),
          },
        ]}
      />
      {allowed.length === 0 ? (
        <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          Your travel date is too close for us to process a visa in time. Please choose a later travel date, or message
          us on WhatsApp and our team will check what&apos;s possible.
        </p>
      ) : allowed.length === 1 ? (
        <p className="text-xs text-ink-tertiary">Only {allowed[0] === "urgent" ? "Express" : "Normal"} processing can meet your travel date.</p>
      ) : null}
    </div>
  );
}
