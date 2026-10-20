import type { ServiceStatusSystemEvent } from "../service-status/events";

/**
 * P11 — the New Visa embassy actions staff take on a booking; each lands on the booking's status tagged with
 * that event. Client doc 2026-10-20: approval is the visa PDF itself (Deliver to customer → "Visa Approved",
 * or "Approved for partial applicants" while other passengers' visas are pending); additional documents
 * come back through the customer's upload (Additional Documents Submitted / Validated).
 */
export const EMBASSY_ACTIONS = {
  READY: { event: "READY_FOR_SUBMISSION", label: "Ready for Submission" },
  APPLIED: { event: "EMBASSY_APPLIED", label: "Applied to Embassy" },
  ADDITIONAL_DOCS: { event: "EMBASSY_ADDITIONAL_DOCS", label: "Additional Documents Required" },
  REJECTED: { event: "EMBASSY_REJECTED", label: "Visa Rejected" },
} as const satisfies Record<string, { event: ServiceStatusSystemEvent; label: string }>;

export type EmbassyAction = keyof typeof EMBASSY_ACTIONS;
export const EMBASSY_ACTION_KEYS = Object.keys(EMBASSY_ACTIONS) as [EmbassyAction, ...EmbassyAction[]];
