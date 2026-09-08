"use client";

import { useFormContext } from "react-hook-form";
import { DateField } from "@/components/forms/DateField";
import type { VisaExtensionRequestValues } from "@/lib/validation/visa-extension-schema";

const MIN_ENTRY_DATE = "1900-01-01";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Visa_Extension.md §4: Entry Date is mandatory for every request, always
 * — even for a returning/known passenger. §5: it's only used for an
 * internal estimated-timeline signal, not shown as a confirmed expiry
 * date, so the copy here deliberately avoids implying we can tell the
 * customer their exact expiry.
 */
export function Step2EntryDate() {
  const {
    register,
    formState: { errors },
  } = useFormContext<VisaExtensionRequestValues>();

  return (
    <div className="flex flex-col gap-4">
      <DateField
        label="UAE Entry Date"
        required
        min={MIN_ENTRY_DATE}
        max={todayIso()}
        hint="The date you most recently entered the UAE on this visa."
        error={errors.entryDate?.message}
        {...register("entryDate")}
      />
      <p className="text-xs text-ink-tertiary">
        Your entry date helps us estimate your visa timeline. Our team will verify your actual visa expiry before
        confirming your extension.
      </p>
    </div>
  );
}
