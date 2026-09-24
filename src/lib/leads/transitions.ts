import type { LeadStatus } from "../../generated/prisma/enums";

/**
 * Step 49 (Internal Dashboard Merged §6) — the 11-state lifecycle graph.
 * Not specified by the client beyond the ordered list of values itself, so
 * this is a proposed graph (same caveat as the schema enum's own doc
 * comment) following the list's natural funnel order:
 * New -> Contacted -> (Follow-up Required / Customer Responded, re-visitable
 * "waiting on the customer" states) -> Qualified -> Quotation Created ->
 * Quotation Accepted -> Payment Pending -> Converted.
 *
 * Lost and Closed are both terminal, reachable from every non-terminal
 * state (client confirmed: Closed is a manual-only alternate terminal
 * state alongside Lost — no automatic process distinguishes them). Follow-up
 * Required is reachable from every non-terminal state too, mirroring the old
 * ON_HOLD's role as a "pause and revisit" state reachable from anywhere
 * active.
 */
const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "FOLLOW_UP_REQUIRED", "LOST", "CLOSED"],
  CONTACTED: ["FOLLOW_UP_REQUIRED", "CUSTOMER_RESPONDED", "QUALIFIED", "LOST", "CLOSED"],
  FOLLOW_UP_REQUIRED: ["CONTACTED", "CUSTOMER_RESPONDED", "QUALIFIED", "LOST", "CLOSED"],
  CUSTOMER_RESPONDED: ["QUALIFIED", "FOLLOW_UP_REQUIRED", "LOST", "CLOSED"],
  QUALIFIED: ["QUOTATION_CREATED", "FOLLOW_UP_REQUIRED", "LOST", "CLOSED"],
  QUOTATION_CREATED: ["QUOTATION_ACCEPTED", "FOLLOW_UP_REQUIRED", "LOST", "CLOSED"],
  QUOTATION_ACCEPTED: ["PAYMENT_PENDING", "FOLLOW_UP_REQUIRED", "LOST", "CLOSED"],
  PAYMENT_PENDING: ["CONVERTED", "FOLLOW_UP_REQUIRED", "LOST", "CLOSED"],
  CONVERTED: [],
  LOST: [],
  CLOSED: [],
};

/** Returns an error message if the transition isn't allowed, or null if it is (same status "transition" is always a no-op success). */
export function assertValidLeadTransition(from: LeadStatus, to: LeadStatus): string | null {
  if (from === to) return null;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    return `Can't move a lead from ${from} to ${to}.`;
  }
  return null;
}

export function getAllowedNextStatuses(from: LeadStatus): LeadStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
