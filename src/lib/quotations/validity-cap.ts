import type { ServiceType } from "../../generated/prisma/enums";
import { getServiceTimelineRules } from "../settings/service-timeline-config";
import { FLIGHT_QUOTE_MAX_VALIDITY_MINUTES, isFlightQuote } from "./pricing";

/**
 * Split out of pricing.ts (Step 42 follow-up): this function needs DB
 * access (via getServiceTimelineRules -> db.ts's pg adapter), so it can't
 * live in pricing.ts alongside the pure isFlightQuote/supportsItinerary/
 * capturesAirline helpers those client components (QuoteBuilder.tsx,
 * LeadDetail.tsx) import directly — doing so pulled `pg` into the browser
 * bundle and broke the production build ("Module not found: util/types").
 * Server-only call sites (the quotation API routes) import from here instead.
 *
 * Step 42 (Admin FINAL handover §6, "quotation response time"): the cap on
 * how long a quote's staff-chosen validity may be set to. Reads
 * `ServiceTimelineConfig.quotationResponseMinutes` for ANY service now,
 * not just Flight Special Fare — an Admin-configured cap applies to
 * whichever service it's set for. Falls back to the pre-existing hardcoded
 * `FLIGHT_QUOTE_MAX_VALIDITY_MINUTES` when Flight Special Fare has no
 * config row yet (preserves exact prior behavior until an Admin opts in),
 * and to "no cap" for every other service when unconfigured — same as
 * before this step.
 */
export async function assertValidityWithinCap(serviceType: ServiceType, validityExpiresAt: string | undefined): Promise<string | null> {
  if (!validityExpiresAt) return null;

  const { quotationResponseMinutes } = await getServiceTimelineRules(serviceType);
  const capMinutes = quotationResponseMinutes ?? (isFlightQuote(serviceType) ? FLIGHT_QUOTE_MAX_VALIDITY_MINUTES : null);
  if (capMinutes === null) return null;

  const maxExpiry = Date.now() + capMinutes * 60 * 1000;
  if (new Date(validityExpiresAt).getTime() > maxExpiry) {
    return `Quote validity can't exceed ${capMinutes} minutes.`;
  }
  return null;
}
