"use client";

import { useEffect, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CalendarClock } from "lucide-react";
import { useWorkingCalendar } from "@/lib/calendar/use-working-calendar";
import { earliestOtbTravelDates } from "@/lib/otb/processing-rules";
import { Step2ProcessingType } from "./Step2ProcessingType";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { useSyncSelectValue } from "@/components/forms/useSyncSelectValue";
import { SearchableSelectField } from "@/components/forms/SearchableSelectField";
import { DateField } from "@/components/forms/DateField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { otbRulesForCountry, useOtbAirlines } from "@/lib/otb/use-otb-airlines";
import { useDestinationCountryOptions } from "@/lib/use-destination-countries";
import { useProcessingTypes } from "@/lib/processing-types/use-processing-types";
import type { OtbRequestValues } from "@/lib/validation/otb-schema";

export function Step1BasicDetails() {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = useFormContext<OtbRequestValues>();
  const { state, airlines } = useOtbAirlines();
  const airlineCode = useWatch({ control, name: "airline" });
  const destinationCountry = useWatch({ control, name: "destinationCountry" });
  const calendar = useWorkingCalendar("INDIA");
  // Client doc 2026-10-14 — destination country first, then only the airlines Admin priced OTB for in that country.
  const countryAirlines = useMemo(
    () =>
      destinationCountry
        ? airlines.filter((entry) => entry.prices.some((price) => price.countryCode.toLowerCase() === destinationCountry.toLowerCase()))
        : [],
    [airlines, destinationCountry]
  );
  const airline = countryAirlines.find((entry) => entry.code === airlineCode);
  // A previously picked airline that doesn't fly OTB for the new country is cleared.
  useEffect(() => {
    if (state !== "success" || !airlineCode) return;
    if (!countryAirlines.some((entry) => entry.code === airlineCode)) setValue("airline", "" as OtbRequestValues["airline"]);
  }, [state, airlineCode, countryAirlines, setValue]);
  // Client corrections 2026-10-05 — dates the airline's TAT can't meet are blocked in the picker.
  const earliest = airline ? earliestOtbTravelDates(otbRulesForCountry(airline, destinationCountry ?? ""), new Date(), calendar) : null;
  const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const destinationCountryOptions = useDestinationCountryOptions("OTB");
  // Live check 2026-10-21 — the earliest-date note uses the same Admin labels as the Processing Type cards.
  const { options: processingOptions } = useProcessingTypes("OTB");
  const typeLabel = (code: "normal" | "urgent") => processingOptions.find((option) => option.code === code)?.label ?? (code === "urgent" ? "Express" : "Normal");
  // Live check 2026-10-21 — coming Back to this step, show the chosen country once the list loads.
  useSyncSelectValue<OtbRequestValues>("destinationCountry", destinationCountryOptions);

  if (state === "loading") return <Skeleton className="h-64 w-full" />;
  if (airlines.length === 0) {
    return (
      <EmptyState
        title="No airlines available yet"
        description="OTB airlines haven't been set up. Please contact us on WhatsApp."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <TextField
        label="Full Name"
        required
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <TextField
        label="Mobile Number"
        type="tel"
        required
        placeholder="+91 98765 43210"
        error={errors.mobile?.message}
        {...register("mobile")}
      />
      <TextField
        label="Email"
        type="email"
        required
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        label="Passport Number"
        required
        error={errors.passportNumber?.message}
        {...register("passportNumber")}
      />
      <SelectField
        label="Destination Country"
        required
        options={destinationCountryOptions}
        error={errors.destinationCountry?.message}
        {...register("destinationCountry")}
      />
      <SearchableSelectField
        name="airline"
        label="Airline"
        required
        hint={destinationCountry ? "Start typing an airline name or code." : "Choose the destination country first."}
        options={countryAirlines.map((entry) => ({ value: entry.code, label: entry.name, detail: entry.code }))}
        error={errors.airline?.message}
      />
      <div className="flex flex-col gap-3 sm:col-span-2">
        {/* Client doc 2026-10-20 (C3) — travel date and departure time on one line. */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <DateField
            label="Travel Date"
            required
            min={earliest?.urgent ?? earliest?.normal ?? undefined}
            hint={airline ? undefined : "Choose the airline first to see the earliest possible date."}
            error={errors.travelDate?.message}
            {...register("travelDate")}
          />
          <TextField
            label="Flight departure time (optional)"
            type="time"
            hint="Travelling today? Same-day OTB is accepted on working days until 4 PM for flights at least 8 hours later — add your departure time."
            error={errors.departureTime?.message}
            {...register("departureTime")}
          />
        </div>
        {airline && earliest ? (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-accent/20 bg-ink-accent/[0.04] px-4 py-3 text-xs text-ink-secondary">
            <CalendarClock className="h-4 w-4 text-ink-accent" aria-hidden="true" />
            <span>
              <span className="font-semibold text-ink-heading">{typeLabel("normal")}:</span> travel from {earliest.normal ? fmt(earliest.normal) : "—"}
            </span>
            {earliest.urgent ? (
              <span>
                <span className="font-semibold text-ink-heading">{typeLabel("urgent")}:</span> travel from {fmt(earliest.urgent)}
              </span>
            ) : null}
            <span className="text-ink-tertiary">Based on {airline.name}&apos;s processing time; weekends and holidays excluded.</span>
          </div>
        ) : null}
      </div>
      <div className="sm:col-span-2">
        <Step2ProcessingType />
      </div>
    </div>
  );
}
