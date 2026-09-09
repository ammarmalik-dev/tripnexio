"use client";

import { useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ExtensionOutcome } from "../../generated/prisma/enums";

const OUTCOME_LABELS: Record<ExtensionOutcome, string> = {
  NOT_ACCEPTED: "Not Accepted",
  REJECTED: "Rejected",
};

const OUTCOME_STYLES: Record<ExtensionOutcome, string> = {
  NOT_ACCEPTED: "bg-warning/10 text-warning",
  REJECTED: "bg-error/10 text-error",
};

interface ExtensionOutcomeControlProps {
  bookingId: string;
  outcome: ExtensionOutcome | null;
  onChanged: () => void;
}

/**
 * Visa_Extension.md §17-18 (Step 15) — "Not Accepted" (refund minus gateway)
 * vs "Rejected" (no refund) are separate terminal outcomes the refund rule
 * engine reads (src/lib/refunds/rules.ts). Once set, this booking moves to
 * CANCELLED and the outcome can't be changed again (matches the
 * one-way-terminal framing in the spec — staff can still see which outcome
 * was recorded).
 */
export function ExtensionOutcomeControl({ bookingId, outcome, onChanged }: ExtensionOutcomeControlProps) {
  const [pending, setPending] = useState(false);

  const handleChange = async (nextOutcome: string) => {
    if (!nextOutcome) return;
    setPending(true);
    try {
      await patchJson(`/api/bookings/${bookingId}/extension-outcome`, { outcome: nextOutcome });
      toast.success(`Extension outcome recorded: ${OUTCOME_LABELS[nextOutcome as ExtensionOutcome]}`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't record this outcome. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (outcome) {
    return (
      <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium", OUTCOME_STYLES[outcome])}>
        Extension: {OUTCOME_LABELS[outcome]}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="extension-outcome-select" className="sr-only">
        Record extension outcome
      </label>
      <select
        id="extension-outcome-select"
        value=""
        disabled={pending}
        onChange={(event) => void handleChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[220px] text-sm")}
      >
        <option value="" disabled>
          Record extension outcome…
        </option>
        <option value="NOT_ACCEPTED">Not Accepted (refund minus gateway)</option>
        <option value="REJECTED">Rejected (no refund)</option>
      </select>
    </div>
  );
}
