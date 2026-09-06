import { cn } from "@/lib/cn";
import { BOOKING_STATUS_LABELS } from "@/lib/crm/labels";
import type { BookingStatus } from "../../generated/prisma/enums";

const STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: "bg-ink-primary/[0.06] text-ink-secondary",
  CONFIRMED: "bg-accent/10 text-accent-on-light",
  PROCESSING: "bg-accent/10 text-accent-on-light",
  COMPLETED: "bg-success/10 text-success",
  CANCELLED: "bg-error/10 text-error",
  REFUNDED: "bg-warning/10 text-warning",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {BOOKING_STATUS_LABELS[status]}
    </span>
  );
}
