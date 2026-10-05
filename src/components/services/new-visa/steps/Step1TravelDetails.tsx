"use client";

import { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { useDestinationCountryOptions } from "@/lib/use-destination-countries";
import { useVisaTypes } from "@/lib/use-visa-types";
import { useNewVisaProducts } from "@/lib/new-visa/use-new-visa-products";
import type { NewVisaRequestValues } from "@/lib/validation/new-visa-schema";

export function Step1TravelDetails() {
  const {
    register,
    setValue,
    getValues,
    control,
    formState: { errors },
  } = useFormContext<NewVisaRequestValues>();
  const destinationCountryOptions = useDestinationCountryOptions();
  const destinationCountry = useWatch({ control, name: "destinationCountry" });
  const { options: visaTypes, loading: visaTypesLoading } = useVisaTypes(destinationCountry);
  const { products, loading: productsLoading } = useNewVisaProducts();
  const countryProducts = products.filter((product) => product.countryCode === destinationCountry);
  const newVisaConfigId = useWatch({ control, name: "newVisaConfigId" });
  // Client correction 2026-10-05: a destination + visa option chosen on the
  // country page is carried forward and not asked again (the customer can
  // still change it). Only when it arrived pre-selected, so picks made here
  // never disappear mid-form.
  const [arrivedPreselected] = useState(() => Boolean(getValues("destinationCountry") && getValues("newVisaConfigId")));
  const [changingSelection, setChangingSelection] = useState(false);
  const preselectedProduct = countryProducts.find((product) => product.id === newVisaConfigId);
  const showSelection = arrivedPreselected && !changingSelection && (productsLoading || Boolean(preselectedProduct));
  const visaTypeValue = useWatch({ control, name: "visaType" });
  const [arrivedWithVisaType] = useState(() => Boolean(getValues("visaType")));
  const preselectedVisaType = visaTypes.find((visaType) => visaType.id === visaTypeValue);
  const askVisaType = visaTypes.length > 1 && !(arrivedWithVisaType && !changingSelection && preselectedVisaType);
  const countryName = destinationCountryOptions.find((option) => option.value === destinationCountry)?.label ?? destinationCountry;

  // P10 — the product (stay duration + entry type) must be one this destination offers.
  useEffect(() => {
    if (productsLoading) return;
    const available = products.filter((product) => product.countryCode === destinationCountry);
    setValue("visaOptionRequired", available.length > 0);
    const current = getValues("newVisaConfigId");
    if (current && !available.some((product) => product.id === current)) setValue("newVisaConfigId", "");
  }, [products, productsLoading, destinationCountry, setValue, getValues]);

  // Admin-managed per destination: required only when this destination has
  // options, and a pick from another destination's list is cleared.
  useEffect(() => {
    if (visaTypesLoading) return;
    setValue("visaTypeRequired", visaTypes.length > 0);
    const current = getValues("visaType");
    if (current && !visaTypes.some((visaType) => visaType.id === current)) setValue("visaType", "");
    // Only one visa type for this destination: pick it rather than ask (2026-10-05).
    if (visaTypes.length === 1 && !getValues("visaType")) setValue("visaType", visaTypes[0].id);
  }, [visaTypes, visaTypesLoading, setValue, getValues]);

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
      {showSelection ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-4 py-3 sm:col-span-2">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-ink-tertiary uppercase">Your visa</span>
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
              label="Visa Option"
              required
              hint="Stay duration and entry type."
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
    </div>
  );
}
