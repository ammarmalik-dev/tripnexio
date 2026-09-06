import type { BookingStatus } from "../../generated/prisma/enums";

/// Proposed default booking lifecycle — same caveat as the enum's own schema comment: not explicitly specified beyond the enum values, review before relying on it.
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

/** Returns an error message if the transition isn't allowed, or null if it's fine. */
export function assertValidBookingTransition(from: BookingStatus, to: BookingStatus): string | null {
  if (from === to) return null;
  if (ALLOWED_TRANSITIONS[from].includes(to)) return null;
  return `Can't move a booking from ${from} to ${to}.`;
}

export function getAllowedNextBookingStatuses(from: BookingStatus): BookingStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
