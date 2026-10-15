import { db } from "../db";
import { DEFAULT_MIN_TRAVEL_DAYS, type NewVisaTravelRules } from "./products";

/**
 * The New Visa timeline of a destination country (Admin → Service
 * Configuration → Timelines → New Visa timeline by country). Client doc
 * 2026-10-15 — "Keep one New Visa Timeline by Country": there is no
 * service-wide value any more (migration 20261015110000 copied it into every
 * enabled country). An empty minimum uses 7 / 3 working days; an empty
 * processing time shows no Expected Approval Date (never guessed).
 */
export async function getNewVisaTravelRules(countryCode?: string | null): Promise<NewVisaTravelRules> {
  const country = countryCode
    ? await db.newVisaCountryTimeline.findFirst({ where: { country: { code: { equals: countryCode, mode: "insensitive" } } } })
    : null;
  return {
    minTravelDaysNormal: country?.minTravelDaysNormal ?? DEFAULT_MIN_TRAVEL_DAYS.normal,
    minTravelDaysExpress: country?.minTravelDaysExpress ?? DEFAULT_MIN_TRAVEL_DAYS.urgent,
    processingDaysNormal: country?.processingDaysNormal ?? null,
    processingDaysExpress: country?.processingDaysExpress ?? null,
  };
}
