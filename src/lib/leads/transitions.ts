import type { LeadStatus } from "../../generated/prisma/enums";

/// Proposed default lead lifecycle — same caveat as the schema's own comment on the LeadStatus enum: not explicitly specified beyond the enum values, review before relying on it. Already used implicitly by quotation-select (-> QUOTED) and payment mark-success (-> CONVERTED); this is the single shared flow every service currently uses (the schema has one LeadStatus enum, not one per service).
const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["CONTACTED", "ON_HOLD", "LOST"],
  CONTACTED: ["QUALIFIED", "ON_HOLD", "LOST"],
  QUALIFIED: ["QUOTED", "ON_HOLD", "LOST"],
  QUOTED: ["CONVERTED", "ON_HOLD", "LOST"],
  CONVERTED: [],
  ON_HOLD: ["CONTACTED", "QUALIFIED", "QUOTED", "LOST"],
  LOST: [],
};

/** Returns an error message if the transition isn't allowed, or null if it's fine. */
export function assertValidLeadTransition(from: LeadStatus, to: LeadStatus): string | null {
  if (from === to) return null;
  if (ALLOWED_TRANSITIONS[from].includes(to)) return null;
  return `Can't move a lead from ${from} to ${to}.`;
}

export function getAllowedNextStatuses(from: LeadStatus): LeadStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
