"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField, fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { toast } from "@/components/ui/Toaster";
import { patchJson, ApiError } from "@/lib/api/client";
import { GST_STATES } from "@/lib/gst/india-states";
import { cn } from "@/lib/cn";

export interface BillingDetails {
  billingAddress: string | null;
  billingStateCode: string | null;
  gstin: string | null;
}

/**
 * Client corrections 2026-10-05 — the invoice "Bill To" details (address,
 * state / place of supply, GSTIN). Used by the customer's own profile and the
 * CRM Customer 360; `endpoint` decides which API saves it.
 */
export function BillingDetailsForm({
  endpoint,
  initial,
  onSaved,
}: {
  endpoint: string;
  initial: BillingDetails;
  onSaved?: (values: BillingDetails) => void;
}) {
  const [values, setValues] = useState({
    billingAddress: initial.billingAddress ?? "",
    billingStateCode: initial.billingStateCode ?? "",
    gstin: initial.gstin ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setErrors({});
    try {
      const saved = await patchJson<BillingDetails>(endpoint, values);
      toast.success("Billing details saved.");
      onSaved?.(saved);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the billing details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <FormField label="Billing address" htmlFor="billing-address" error={errors.billingAddress?.[0]}>
        <textarea
          id="billing-address"
          rows={2}
          value={values.billingAddress}
          onChange={(event) => setValues((current) => ({ ...current, billingAddress: event.target.value }))}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.billingAddress), "min-h-[64px] py-2")}
          placeholder="House / street, city, PIN code"
        />
      </FormField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="State (place of supply)" htmlFor="billing-state" error={errors.billingStateCode?.[0]}>
          <select
            id="billing-state"
            value={values.billingStateCode}
            onChange={(event) => setValues((current) => ({ ...current, billingStateCode: event.target.value }))}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.billingStateCode))}
          >
            <option value="">Not set</option>
            {GST_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="GSTIN (business only)" htmlFor="billing-gstin" error={errors.gstin?.[0]} hint="Leave empty for an individual.">
          <input
            id="billing-gstin"
            value={values.gstin}
            maxLength={15}
            onChange={(event) => setValues((current) => ({ ...current, gstin: event.target.value.toUpperCase() }))}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.gstin), "uppercase")}
            placeholder="e.g. 07ABCDE1234F1Z5"
          />
        </FormField>
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void save()} isLoading={saving}>
          Save billing details
        </Button>
      </div>
    </div>
  );
}
