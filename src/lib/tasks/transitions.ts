import type { TaskStatus } from "../../generated/prisma/enums";

/// Proposed default task lifecycle — same caveat as LeadStatus/BookingStatus/
/// RefundStatus: not explicitly specified beyond "a staff member can view/
/// complete it," review before relying on it.
const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  OPEN: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

/** Returns an error message if the transition isn't allowed, or null if it's fine. */
export function assertValidTaskTransition(from: TaskStatus, to: TaskStatus): string | null {
  if (from === to) return null;
  if (ALLOWED_TRANSITIONS[from].includes(to)) return null;
  return `Can't move a task from ${from} to ${to}.`;
}

export function getAllowedNextTaskStatuses(from: TaskStatus): TaskStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
