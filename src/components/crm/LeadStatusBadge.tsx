import { cn } from "@/lib/cn";
import { LEAD_STATUS_LABELS } from "@/lib/crm/labels";
import type { LeadStatus } from "../../generated/prisma/enums";

const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: "bg-accent/10 text-accent-on-light",
  CONTACTED: "bg-ink-primary/[0.06] text-ink-secondary",
  QUALIFIED: "bg-ink-primary/[0.06] text-ink-secondary",
  QUOTED: "bg-accent/10 text-accent-on-light",
  CONVERTED: "bg-success/10 text-success",
  ON_HOLD: "bg-warning/10 text-warning",
  LOST: "bg-error/10 text-error",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {LEAD_STATUS_LABELS[status]}
    </span>
  );
}
