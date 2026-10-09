import { db } from "../db";
import { getServiceTimelineRules } from "../settings/service-timeline-config";
import { DEFAULT_MIN_TRAVEL_DAYS, type NewVisaTravelRules } from "./products";

/**
 * The Admin-configured New Visa timeline (Timelines / SLA), falling back to
 * 7 / 3 working days before travel. Client testing 2026-10-09 (B31) — with a
 * destination country, that country's own values (Admin → Timelines → per
 * country) win field by field; an empty field uses the service-wide value.
 */
export async function getNewVisaTravelRules(countryCode?: string | null): Promise<NewVisaTravelRules> {
  const timeline = await getServiceTimelineRules("NEW_VISA");
  const country = countryCode
    ? await db.newVisaCountryTimeline.findFirst({ where: { country: { code: { equals: countryCode, mode: "insensitive" } } } })
    : null;
  return {
    minTravelDaysNormal: country?.minTravelDaysNormal ?? timeline.minTravelDaysNormal ?? DEFAULT_MIN_TRAVEL_DAYS.normal,
    minTravelDaysExpress: country?.minTravelDaysExpress ?? timeline.minTravelDaysExpress ?? DEFAULT_MIN_TRAVEL_DAYS.urgent,
    processingDaysNormal: country?.processingDaysNormal ?? timeline.processingDaysNormal,
    processingDaysExpress: country?.processingDaysExpress ?? timeline.processingDaysExpress,
  };
}
