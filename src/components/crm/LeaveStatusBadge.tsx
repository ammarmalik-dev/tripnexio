import { cn } from "@/lib/cn";
import { LEAVE_STATUS_LABELS } from "@/lib/crm/labels";
import type { LeaveStatus } from "../../generated/prisma/enums";

const STATUS_STYLES: Record<LeaveStatus, string> = {
  PENDING: "bg-ink-primary/[0.06] text-ink-secondary",
  APPROVED: "bg-success/10 text-success",
  REJECTED: "bg-error/10 text-error",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {LEAVE_STATUS_LABELS[status]}
    </span>
  );
}
