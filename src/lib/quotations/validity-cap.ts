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
export async function assertValidityWithinCap(
  serviceType: ServiceType,
  validityExpiresAt: string | undefined,
  /** Admin handover §6 — the lead's country, so its country timeline (if any) applies. */
  countryId?: string | null
): Promise<string | null> {
  if (!validityExpiresAt) return null;

  const capMinutes = await validityCapMinutes(serviceType, countryId);
  if (capMinutes === null) return null;

  const maxExpiry = Date.now() + capMinutes * 60 * 1000;
  if (new Date(validityExpiresAt).getTime() > maxExpiry) {
    return `Quote validity can't exceed ${capMinutes} minutes.`;
  }
  return null;
}

/**
 * The longest validity a quote may carry. Client doc 2026-10-20 (Special Fare key rules): "Quotation validity: up to
 * 30 minutes" — an Admin response time can shorten a flight quote's window, never lengthen it past 30.
 */
async function validityCapMinutes(serviceType: ServiceType, countryId?: string | null): Promise<number | null> {
  const { quotationResponseMinutes } = await getServiceTimelineRules(serviceType, countryId);
  if (isFlightQuote(serviceType)) return Math.min(quotationResponseMinutes ?? FLIGHT_QUOTE_MAX_VALIDITY_MINUTES, FLIGHT_QUOTE_MAX_VALIDITY_MINUTES);
  return quotationResponseMinutes ?? null;
}

/**
 * Client 2026-10-23 audit — a Special Fare quote sent without a validity never expired, got no 10-minute reminders
 * and stayed payable. A flight quote that goes to the customer without one is valid for the full window (30 min).
 */
export async function effectiveQuoteValidity(
  serviceType: ServiceType,
  validityExpiresAt: string | undefined,
  countryId?: string | null
): Promise<string | undefined> {
  if (validityExpiresAt || !isFlightQuote(serviceType)) return validityExpiresAt;
  const capMinutes = (await validityCapMinutes(serviceType, countryId)) ?? FLIGHT_QUOTE_MAX_VALIDITY_MINUTES;
  return new Date(Date.now() + capMinutes * 60 * 1000).toISOString();
}
