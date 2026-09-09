"use client";

import { useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { LeadTemperatureBadge } from "./LeadTemperatureBadge";
import { LEAD_TEMPERATURE_LABELS, LEAD_TEMPERATURE_OPTIONS } from "@/lib/crm/labels";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { LeadTemperature } from "../../generated/prisma/enums";

const UNSET_VALUE = "__unset__";

interface LeadTemperatureControlProps {
  leadId: string;
  temperature: LeadTemperature | null;
  onChanged: (temperature: LeadTemperature | null) => void;
}

/** CRM.md §5 (Step 12) — no transition rules like LeadStatusControl, staff can set/clear freely. */
export function LeadTemperatureControl({ leadId, temperature, onChanged }: LeadTemperatureControlProps) {
  const [pending, setPending] = useState(false);

  const handleChange = async (rawValue: string) => {
    const nextTemperature = rawValue === UNSET_VALUE ? null : (rawValue as LeadTemperature);
    if (nextTemperature === temperature) return;
    setPending(true);
    try {
      await patchJson(`/api/leads/${leadId}/temperature`, { temperature: nextTemperature });
      toast.success(`Temperature set to ${nextTemperature ? LEAD_TEMPERATURE_LABELS[nextTemperature] : "Not set"}`);
      onChanged(nextTemperature);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the temperature. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <LeadTemperatureBadge temperature={temperature} />
      <label htmlFor="lead-temperature-select" className="sr-only">
        Set lead temperature
      </label>
      <select
        id="lead-temperature-select"
        value={temperature ?? UNSET_VALUE}
        disabled={pending}
        onChange={(event) => void handleChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[140px] text-sm")}
      >
        <option value={UNSET_VALUE}>Not set</option>
        {LEAD_TEMPERATURE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
