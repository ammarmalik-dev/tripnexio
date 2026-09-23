import type { LeaveStatus } from "../../generated/prisma/enums";

/**
 * Step 38: a leave request is decided exactly once — PENDING moves to
 * APPROVED or REJECTED, both terminal. There's no "undo" transition; if
 * staff made a mistake, correcting it is a new leave request (same
 * philosophy as StaffLeaveManager.tsx's existing "delete and re-add" note
 * for dates/reason).
 */
const ALLOWED_TRANSITIONS: Record<LeaveStatus, LeaveStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

/** Returns an error message if the transition isn't allowed, or null if it's fine. */
export function assertValidLeaveTransition(from: LeaveStatus, to: LeaveStatus): string | null {
  if (from === to) return null;
  if (ALLOWED_TRANSITIONS[from].includes(to)) return null;
  return `Can't move a leave request from ${from} to ${to}.`;
}

export function getAllowedNextLeaveStatuses(from: LeaveStatus): LeaveStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
