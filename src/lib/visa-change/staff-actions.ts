import type { ServiceStatusSystemEvent } from "../service-status/events";

/** P14 — Visa Change staff actions after the package; each lands on the booking status tagged with that event. */
export const VISA_CHANGE_ACTIONS = {
  EXIT_COMPLETED: { event: "VC_EXIT_COMPLETED", label: "Exit Completed" },
  // Client doc 2026-10-20 — after the exit: Ready for Submission → Applied to Embassy; approval is the visa PDF (Deliver to customer).
  READY: { event: "READY_FOR_SUBMISSION", label: "Ready for Submission" },
  APPLIED: { event: "EMBASSY_APPLIED", label: "Applied to Embassy" },
  ADDITIONAL_DOCS: { event: "EMBASSY_ADDITIONAL_DOCS", label: "Additional Documents Required" },
  REJECTED: { event: "EMBASSY_REJECTED", label: "Visa Rejected" },
} as const satisfies Record<string, { event: ServiceStatusSystemEvent; label: string }>;

export type VisaChangeAction = keyof typeof VISA_CHANGE_ACTIONS;
export const VISA_CHANGE_ACTION_KEYS = Object.keys(VISA_CHANGE_ACTIONS) as [VisaChangeAction, ...VisaChangeAction[]];

export const EXIT_METHOD_LABELS = { AIRPORT_TO_AIRPORT: "Airport-to-Airport", BORDER_EXIT: "Border Exit" } as const;
export type ExitMethod = keyof typeof EXIT_METHOD_LABELS;
