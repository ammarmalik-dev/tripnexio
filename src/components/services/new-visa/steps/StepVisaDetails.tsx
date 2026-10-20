"use client";

import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { SelectField } from "@/components/forms/SelectField";
import { DateField } from "@/components/forms/DateField";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDestinationCountryOptions } from "@/lib/use-destination-countries";
import { useVisaTypes } from "@/lib/use-visa-types";
import { useNationalities } from "@/lib/use-nationalities";
import { useNewVisaProducts } from "@/lib/new-visa/use-new-visa-products";
import { useNewVisaTravelRules } from "@/lib/new-visa/use-travel-rules";
import { useNewVisaRates } from "@/lib/new-visa/use-new-visa-rates";
import { allowedProcessingTypes } from "@/lib/new-visa/products";
import { useCountryWorkingCalendar } from "@/lib/calendar/use-working-calendar";
import { workingDaysBetween } from "@/lib/calendar/working-calendar";
import { useProcessingTypes } from "@/lib/processing-types/use-processing-types";
import { formatCurrency } from "@/lib/format-currency";
import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";
import { ExpectedApprovalDate } from "../ExpectedApprovalDate";

/**
 * Client doc 2026-10-15 — the first New Visa form: Country, Visa Option, Visa
 * Type, nationality, Expected Travel Date, Normal / Express with the Adult and
 * Child prices, and the Expected Approval Date together. What the customer
 * already picked on the country page is carried forward and shown as one line
 * (with "Change"), never asked again.
 *
 * P10 — Normal needs the travel date at least N working days away, Express at
 * least M (the country's timeline; 7 / 3 by default), counted on the
 * destination's own calendar. A type that can't meet the date is shown but
 * can't be picked. The server applies the same rules on submit.
 */
export function StepVisaDetails() {
  const {
    register,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useFormContext<NewVisaRequestValues>();
  const destinationCountryOptions = useDestinationCountryOptions("NEW_VISA");
  const destinationCountry = useWatch({ control, name: "destinationCountry" });
  const newVisaConfigId = useWatch({ control, name: "newVisaConfigId" });
  const visaTypeValue = useWatch({ control, name: "visaType" });
  const nationalityId = useWatch({ control, name: "nationalityId" });
  const travelDate = useWatch({ control, name: "travelDate" });
  const processingType = useWatch({ control, name: "processingType" });

  const { options: visaTypes, loading: visaTypesLoading } = useVisaTypes(destinationCountry);
  const { products, loading: productsLoading } = useNewVisaProducts();
  const { options: nationalities, loading: nationalitiesLoading } = useNationalities();
  const countryProducts = products.filter((product) => product.countryCode === destinationCountry);
  const calendar = useCountryWorkingCalendar(destinationCountry);
  const rules = useNewVisaTravelRules(destinationCountry);
  const rates = useNewVisaRates(destinationCountry, newVisaConfigId, nationalityId ?? "");
  const { state: optionsState, options: allMasterOptions } = useProcessingTypes("NEW_VISA");

  // Carried forward from the country page: shown as one line, not asked again (the customer can still change it).
  const [arrivedPreselected] = useState(() => Boolean(getValues("destinationCountry") && getValues("newVisaConfigId")));
  const [changingSelection, setChangingSelection] = useState(false);
  const preselectedProduct = countryProducts.find((product) => product.id === newVisaConfigId);
  const showSelection = arrivedPreselected && !changingSelection && (productsLoading || Boolean(preselectedProduct));
  const [arrivedWithVisaType] = useState(() => Boolean(getValues("visaType")));
  const preselectedVisaType = visaTypes.find((visaType) => visaType.id === visaTypeValue);
  // Client doc 2026-10-20 (E6 / E7) — the visa category is part of each option (Stay · Entry · Category), so a
  // separate Visa Type is asked only for a destination without options.
  const usesProducts = countryProducts.length > 0;
  const askVisaType = !usesProducts && visaTypes.length > 1 && !(arrivedWithVisaType && !changingSelection && preselectedVisaType);
  const countryName = destinationCountryOptions.find((option) => option.value === destinationCountry)?.label ?? destinationCountry;

  // P10 — the visa option (stay duration + entry type) must be one this destination offers.
  useEffect(() => {
    if (productsLoading) return;
    const available = products.filter((product) => product.countryCode === destinationCountry);
    setValue("visaOptionRequired", available.length > 0);
    const current = getValues("newVisaConfigId");
    if (current && !available.some((product) => product.id === current)) setValue("newVisaConfigId", "");
    // Only one option for this destination: pick it rather than ask.
    if (available.length === 1 && !getValues("newVisaConfigId")) setValue("newVisaConfigId", available[0].id);
  }, [products, productsLoading, destinationCountry, setValue, getValues]);

  // Client doc 2026-10-15 — nationality is asked whenever the master has any (prices can differ by it).
  useEffect(() => {
    if (!nationalitiesLoading) setValue("nationalityRequired", nationalities.length > 0);
  }, [nationalities, nationalitiesLoading, setValue]);

  // Admin-managed per destination: required only when this destination has visa types and no options.
  useEffect(() => {
    if (visaTypesLoading || productsLoading) return;
    if (usesProducts) {
      setValue("visaTypeRequired", false);
      setValue("visaType", "");
      return;
    }
    setValue("visaTypeRequired", visaTypes.length > 0);
    const current = getValues("visaType");
    if (current && !visaTypes.some((visaType) => visaType.id === current)) setValue("visaType", "");
    if (visaTypes.length === 1 && !getValues("visaType")) setValue("visaType", visaTypes[0].id);
  }, [visaTypes, visaTypesLoading, productsLoading, usesProducts, setValue, getValues]);

  // The request schema stores only these codes; a code Admin disabled isn't offered (and the server rejects it).
  const masterOptions = allMasterOptions.filter((option) => option.code === "normal" || option.code === "urgent");
  // Client doc 2026-10-20 (E1 / E2) — prices are judged only once the option (and nationality, where asked) is
  // chosen: before that a product-specific price would wrongly read "Not offered" / "travel date too close".
  const pricesReady = (countryProducts.length <= 1 || Boolean(newVisaConfigId)) && (nationalities.length === 0 || Boolean(nationalityId));
  const offered = (code: "normal" | "urgent") => !pricesReady || !rates || rates[code].adult !== null || rates[code].child !== null;
  const workingDays = travelDate ? workingDaysBetween(travelDate, new Date(), calendar) : Number.POSITIVE_INFINITY;
  const byDate = allowedProcessingTypes(workingDays, rules).filter((code) => masterOptions.some((option) => option.code === code));
  const allowed = byDate.filter((code) => offered(code));
  const allowedKey = allowed.join(",");

  // A choice made before the travel date (or the option) changed may no longer be possible.
  useEffect(() => {
    if (optionsState === "loading") return;
    if (processingType && !allowedKey.split(",").includes(processingType)) {
      setValue("processingType", undefined as unknown as NewVisaRequestValues["processingType"]);
    }
  }, [allowedKey, optionsState, processingType, setValue]);

  const money = (value: number | null | undefined) => (value != null ? formatCurrency(value) : "—");
  const days = (n: number) => `${n} working day${n === 1 ? "" : "s"}`;
  const labelFor = (code: string) => masterOptions.find((option) => option.code === code)?.label ?? code;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        {showSelection ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-4 py-3 sm:col-span-2">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-ink-tertiary uppercase">Your selection</span>
              <span className="text-sm font-semibold text-ink-heading">
                {countryName} · {preselectedProduct?.label ?? "…"}
                {preselectedVisaType && !askVisaType ? ` · ${preselectedVisaType.name}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setChangingSelection(true)}
              className="text-sm font-medium text-ink-accent underline-offset-4 hover:underline"
            >
              Change
            </button>
          </div>
        ) : (
          <>
            <SelectField
              label="Destination Country"
              required
              options={destinationCountryOptions}
              error={errors.destinationCountry?.message}
              {...register("destinationCountry")}
            />
            {countryProducts.length > 0 ? (
              <SelectField
                label="Visa"
                required
                hint="Stay duration · Entry type · Visa category."
                options={countryProducts.map((product) => ({ value: product.id, label: product.label }))}
                error={errors.newVisaConfigId?.message}
                {...register("newVisaConfigId")}
              />
            ) : null}
          </>
        )}
        {askVisaType ? (
          <SelectField
            label="Visa Type"
            required
            options={visaTypes.map((visaType) => ({ value: visaType.id, label: visaType.name }))}
            error={errors.visaType?.message}
            {...register("visaType")}
          />
        ) : null}
        {nationalities.length > 0 ? (
          <SelectField
            label="Nationality (as on passport)"
            required
            placeholder="Select your nationality"
            hint="Prices can differ by nationality."
            options={nationalities.map((nationality) => ({ value: nationality.id, label: nationality.name }))}
            error={errors.nationalityId?.message}
            {...register("nationalityId")}
          />
        ) : null}
        <DateField label="Expected Travel Date" required min={today} error={errors.travelDate?.message} {...register("travelDate")} />
      </div>

      {optionsState === "loading" ? (
        <Skeleton className="h-28 w-full" />
      ) : (
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
            const prices = !pricesReady
              ? nationalities.length > 0 && !nationalityId
                ? "Choose your visa and nationality to see the price."
                : "Choose your visa to see the price."
              : rates
                ? `Adult ${money(rates[code].adult)} · Child ${money(rates[code].child)}`
                : "Loading prices…";
            return {
              value: option.code,
              label: option.label,
              description: !offered(code)
                ? "Not offered for this visa."
                : isAllowed
                  ? prices
                  : `${prices} — needs your travel date at least ${days(minDays)} away.`,
              disabled: !isAllowed,
            };
          })}
        />
      )}

      {processingType && allowed.includes(processingType) ? (
        <ExpectedApprovalDate
          label={labelFor(processingType)}
          workingDays={processingType === "urgent" ? rules.processingDaysExpress : rules.processingDaysNormal}
          calendar={calendar}
        />
      ) : null}
      {travelDate && byDate.length === 0 && optionsState !== "loading" ? (
        <p role="alert" className="rounded-lg bg-error/10 px-4 py-3 text-sm text-error">
          Your travel date is too close for us to process this visa in time. Please choose a later travel date, or message us on WhatsApp and
          our team will check what&apos;s possible.
        </p>
      ) : null}
    </div>
  );
}
