/**
 * Client corrections 2026-10-05 — what a Visa Change package includes and
 * excludes, per method (the client's own wording). Shown on the Visa Change
 * page and used as the defaults on a Visa Change quotation, where staff can
 * edit them for that quote.
 */
export const VISA_CHANGE_INCLUSIONS = {
  AIRPORT_TO_AIRPORT: ["Round-trip flight ticket", "New UAE visa"],
  BORDER_EXIT: ["Round-trip border transportation", "Stay, if applicable", "New UAE visa", "Oman visa"],
} as const;

export const VISA_CHANGE_EXCLUSIONS = ["Fines", "Border / immigration fees", "Meals"] as const;

export function defaultVisaChangeInclusions(changeType: unknown): string[] {
  return changeType === "BORDER_EXIT" ? [...VISA_CHANGE_INCLUSIONS.BORDER_EXIT] : changeType === "AIRPORT_TO_AIRPORT" ? [...VISA_CHANGE_INCLUSIONS.AIRPORT_TO_AIRPORT] : [];
}
