import type { RefundStatus } from "../../generated/prisma/enums";

/// Proposed default refund lifecycle — same caveat as LeadStatus/BookingStatus: not explicitly specified beyond the enum values, review before relying on it.
const ALLOWED_TRANSITIONS: Record<RefundStatus, RefundStatus[]> = {
  PENDING: ["PROCESSING", "REJECTED"],
  PROCESSING: ["COMPLETED", "REJECTED"],
  COMPLETED: [],
  REJECTED: [],
};

/** Returns an error message if the transition isn't allowed, or null if it's fine. */
export function assertValidRefundTransition(from: RefundStatus, to: RefundStatus): string | null {
  if (from === to) return null;
  if (ALLOWED_TRANSITIONS[from].includes(to)) return null;
  return `Can't move a refund from ${from} to ${to}.`;
}

export function getAllowedNextRefundStatuses(from: RefundStatus): RefundStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
