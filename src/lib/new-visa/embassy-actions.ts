import type { ServiceStatusSystemEvent } from "../service-status/events";

/** P11 — the New Visa embassy actions staff take on a booking; each lands on the booking's status tagged with that event. */
export const EMBASSY_ACTIONS = {
  READY: { event: "DOCUMENTS_VALIDATED", label: "Ready for Submission" },
  APPLIED: { event: "EMBASSY_APPLIED", label: "Applied to Embassy" },
  ADDITIONAL_DOCS: { event: "EMBASSY_ADDITIONAL_DOCS", label: "Additional Documents Required" },
  RESUBMITTED: { event: "EMBASSY_RESUBMITTED", label: "Re-submitted" },
  APPROVED: { event: "EMBASSY_APPROVED", label: "Visa Approved" },
  REJECTED: { event: "EMBASSY_REJECTED", label: "Rejected" },
} as const satisfies Record<string, { event: ServiceStatusSystemEvent; label: string }>;

export type EmbassyAction = keyof typeof EMBASSY_ACTIONS;
export const EMBASSY_ACTION_KEYS = Object.keys(EMBASSY_ACTIONS) as [EmbassyAction, ...EmbassyAction[]];
