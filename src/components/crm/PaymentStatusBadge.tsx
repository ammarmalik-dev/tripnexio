import { cn } from "@/lib/cn";
import { PAYMENT_STATUS_LABELS } from "@/lib/crm/labels";
import type { PaymentStatus } from "../../generated/prisma/enums";

const STATUS_STYLES: Record<PaymentStatus, string> = {
  PENDING: "bg-ink-primary/[0.06] text-ink-secondary",
  SUCCESS: "bg-success/10 text-success",
  FAILED: "bg-error/10 text-error",
  EXPIRED: "bg-warning/10 text-warning",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
