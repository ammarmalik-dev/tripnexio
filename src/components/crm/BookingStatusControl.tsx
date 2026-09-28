"use client";

import { BookingStatusBadge } from "./BookingStatusBadge";
import { ServiceStatusControl } from "./ServiceStatusControl";
import type { BookingStatus } from "../../generated/prisma/enums";

interface BookingStatusControlProps {
  bookingId: string;
  status: BookingStatus;
  onChanged: (status: BookingStatus) => void;
}

/** Booking Change Status — the booking's own per-service status list (P08), coarse badge alongside. */
export function BookingStatusControl({ bookingId, status, onChanged }: BookingStatusControlProps) {
  return (
    <ServiceStatusControl<BookingStatus>
      endpoint={`/api/bookings/${bookingId}/status`}
      badge={<BookingStatusBadge status={status} />}
      onChanged={onChanged}
      selectId="booking-status-select"
    />
  );
}
