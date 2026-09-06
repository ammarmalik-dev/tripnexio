"use client";

import { useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { LeadStatusBadge } from "./LeadStatusBadge";
import { LEAD_STATUS_LABELS } from "@/lib/crm/labels";
import { getAllowedNextStatuses } from "@/lib/leads/transitions";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { LeadStatus } from "../../generated/prisma/enums";

interface LeadStatusControlProps {
  leadId: string;
  status: LeadStatus;
  onChanged: (status: LeadStatus) => void;
}

export function LeadStatusControl({ leadId, status, onChanged }: LeadStatusControlProps) {
  const [pending, setPending] = useState(false);
  const nextStatuses = getAllowedNextStatuses(status);

  const handleChange = async (nextStatus: string) => {
    if (!nextStatus || nextStatus === status) return;
    setPending(true);
    try {
      await patchJson(`/api/leads/${leadId}/status`, { status: nextStatus });
      toast.success(`Status updated to ${LEAD_STATUS_LABELS[nextStatus as LeadStatus]}`);
      onChanged(nextStatus as LeadStatus);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <LeadStatusBadge status={status} />
      {nextStatuses.length > 0 ? (
        <>
          <label htmlFor="lead-status-select" className="sr-only">
            Change lead status
          </label>
          <select
            id="lead-status-select"
            value=""
            disabled={pending}
            onChange={(event) => void handleChange(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[180px] text-sm")}
          >
            <option value="" disabled>
              Move to…
            </option>
            {nextStatuses.map((next) => (
              <option key={next} value={next}>
                {LEAD_STATUS_LABELS[next]}
              </option>
            ))}
          </select>
        </>
      ) : (
        <span className="text-xs text-ink-tertiary">Final status — no further transitions</span>
      )}
    </div>
  );
}
