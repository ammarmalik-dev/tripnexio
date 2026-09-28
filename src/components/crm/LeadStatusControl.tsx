"use client";

import { LeadStatusBadge } from "./LeadStatusBadge";
import { ServiceStatusControl } from "./ServiceStatusControl";
import type { LeadStatus } from "../../generated/prisma/enums";

interface LeadStatusControlProps {
  leadId: string;
  status: LeadStatus;
  onChanged: (status: LeadStatus) => void;
}

/** Lead Change Status — the lead's own per-service status list (P08), coarse badge alongside. */
export function LeadStatusControl({ leadId, status, onChanged }: LeadStatusControlProps) {
  return (
    <ServiceStatusControl<LeadStatus>
      endpoint={`/api/leads/${leadId}/status`}
      badge={<LeadStatusBadge status={status} />}
      onChanged={onChanged}
      selectId="lead-status-select"
    />
  );
}
