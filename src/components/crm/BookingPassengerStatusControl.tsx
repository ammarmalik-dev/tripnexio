"use client";

import { useState } from "react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { BookingStatusBadge } from "./BookingStatusBadge";
import { BOOKING_STATUS_LABELS } from "@/lib/crm/labels";
import { getAllowedNextBookingStatuses } from "@/lib/bookings/transitions";
import { patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { BookingStatus } from "../../generated/prisma/enums";

interface BookingPassengerStatusControlProps {
  bookingId: string;
  passengerId: string;
  status: BookingStatus;
  onChanged: (status: BookingStatus) => void;
}

/** CRM.md §12 (Step 14) — same transition rules as BookingStatusControl, applied per-passenger instead of at the booking level. */
export function BookingPassengerStatusControl({ bookingId, passengerId, status, onChanged }: BookingPassengerStatusControlProps) {
  const [pending, setPending] = useState(false);
  const nextStatuses = getAllowedNextBookingStatuses(status);

  const handleChange = async (nextStatus: string) => {
    if (!nextStatus || nextStatus === status) return;
    setPending(true);
    try {
      await patchJson(`/api/bookings/${bookingId}/passengers/${passengerId}/status`, { status: nextStatus });
      toast.success(`Status updated to ${BOOKING_STATUS_LABELS[nextStatus as BookingStatus]}`);
      onChanged(nextStatus as BookingStatus);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this passenger's status. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <BookingStatusBadge status={status} />
      {nextStatuses.length > 0 ? (
        <>
          <label htmlFor={`passenger-status-${passengerId}`} className="sr-only">
            Change this passenger&rsquo;s status
          </label>
          <select
            id={`passenger-status-${passengerId}`}
            value=""
            disabled={pending}
            onChange={(event) => void handleChange(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-8 w-auto min-w-[160px] text-xs")}
          >
            <option value="" disabled>
              Move to…
            </option>
            {nextStatuses.map((next) => (
              <option key={next} value={next}>
                {BOOKING_STATUS_LABELS[next]}
              </option>
            ))}
          </select>
        </>
      ) : (
        <span className="text-xs text-ink-tertiary">Final status</span>
      )}
    </div>
  );
}
