import type { ServiceType } from "../../generated/prisma/enums";

/**
 * P21 item 6 — the one rule for the "Urgent" badge shown on the CRM Leads
 * list, Bookings list, and Command Centre "Most Action Required" queue.
 *
 * Both New Visa and OTB store the customer's processing choice as
 * `Lead.details.processingType` = "normal" | "urgent" (see
 * new-visa-schema.ts / otb-schema.ts — the whole validated submission is
 * persisted into Lead.details by createLeadFromSubmission). New Visa's
 * stored "urgent" is what the customer sees labelled "Express" (the
 * fast/same-day tier — there is no separate same-day value in the data
 * model); OTB keeps the "Urgent" wording. No other service carries a
 * processingType, so every other service is never flagged here.
 */
const URGENCY_SERVICES: ReadonlySet<ServiceType> = new Set<ServiceType>(["NEW_VISA", "OTB"]);

export function isUrgentRequest(serviceType: ServiceType, details: unknown): boolean {
  if (!URGENCY_SERVICES.has(serviceType)) return false;
  if (details === null || typeof details !== "object" || Array.isArray(details)) return false;
  return (details as Record<string, unknown>).processingType === "urgent";
}

/** Badge wording per service — New Visa's urgent tier is customer-facing "Express". */
export function urgentBadgeLabel(serviceType: ServiceType): string {
  return serviceType === "NEW_VISA" ? "Express" : "Urgent";
}
