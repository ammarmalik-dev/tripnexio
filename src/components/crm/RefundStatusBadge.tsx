import { cn } from "@/lib/cn";
import { REFUND_STATUS_LABELS } from "@/lib/crm/labels";
import type { RefundStatus } from "../../generated/prisma/enums";

const STATUS_STYLES: Record<RefundStatus, string> = {
  PENDING: "bg-ink-primary/[0.06] text-ink-secondary",
  PROCESSING: "bg-accent/10 text-accent-on-light",
  COMPLETED: "bg-success/10 text-success",
  REJECTED: "bg-error/10 text-error",
};

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {REFUND_STATUS_LABELS[status]}
    </span>
  );
}
