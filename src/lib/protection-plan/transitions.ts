import type { ProtectionPlanStatus } from "../../generated/prisma/enums";

/// Proposed default lifecycle derived from New_Visa.md §8-9's own narrative
/// (the 14 statuses are given as a flat list, not a formal state machine) —
/// same "review before relying on it" caveat as every other proposed-default
/// lifecycle in this codebase. PURCHASED is only ever reached via the
/// dedicated purchase action (src/lib/protection-plan/purchase.ts), not this
/// generic transition map, since it has its own mandatory-T&C precondition.
const ALLOWED_TRANSITIONS: Record<ProtectionPlanStatus, ProtectionPlanStatus[]> = {
  NOT_OFFERED: ["OFFERED"],
  OFFERED: ["SELECTED_TERMS_PENDING", "CANCELLED"],
  SELECTED_TERMS_PENDING: ["TERMS_ACCEPTED", "CANCELLED"],
  // TERMS_ACCEPTED -> PURCHASED happens inside the purchase action itself,
  // not as a standalone staff-picked transition.
  TERMS_ACCEPTED: ["CANCELLED"],
  PURCHASED: ["UNDER_ELIGIBILITY_REVIEW"],
  UNDER_ELIGIBILITY_REVIEW: ["ELIGIBLE", "INELIGIBLE"],
  // "If later found ineligible: Protection Plan may be cancelled/rejected
  // according to accepted terms" — an already-eligible plan can still move
  // to CANCELLED if something changes later.
  ELIGIBLE: ["CANCELLED"],
  INELIGIBLE: ["CANCELLED", "REFUND_UNDER_REVIEW"],
  CANCELLED: ["REFUND_UNDER_REVIEW"],
  REFUND_UNDER_REVIEW: ["REFUND_APPROVED", "REFUND_REJECTED"],
  REFUND_APPROVED: ["REFUND_PROCESSING"],
  REFUND_PROCESSING: ["REFUND_COMPLETED"],
  REFUND_REJECTED: [],
  REFUND_COMPLETED: [],
};

/** Returns an error message if the transition isn't allowed, or null if it's fine. */
export function assertValidProtectionPlanTransition(from: ProtectionPlanStatus, to: ProtectionPlanStatus): string | null {
  if (from === to) return null;
  if (ALLOWED_TRANSITIONS[from].includes(to)) return null;
  return `Can't move a Protection Plan from ${from} to ${to}.`;
}

export function getAllowedNextProtectionPlanStatuses(from: ProtectionPlanStatus): ProtectionPlanStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
