import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";
import {
  COUNTRY_TIMELINE_FIELDS,
  EMPTY_TIMELINE_RULES,
  isCountryTimelineService,
  mergeTimelineRules,
  type CountryTimelineOverride,
  type ServiceTimelineRules,
} from "./service-timeline-merge";

export type { ServiceTimelineRules } from "./service-timeline-merge";

/**
 * Step 42 — reads the central Timeline/SLA config for one service. Missing
 * row or `active: false` both resolve to all-null ("not configured"),
 * matching this app's usual fail-safe pattern: callers fall back to their
 * own pre-existing hardcoded default rather than guessing.
 *
 * Admin handover §6 — pass the lead's `countryId` to get the service value
 * merged with that country's ServiceCountryTimeline (Return Ticket, Visa
 * Extension, Visa Change, Special Fare; a blank country field = service
 * value). A disabled service config disables its country rows too.
 */
export async function getServiceTimelineRules(serviceType: ServiceType, countryId?: string | null): Promise<ServiceTimelineRules> {
  const config = await db.serviceTimelineConfig.findUnique({ where: { serviceType } });
  if (config && !config.active) return EMPTY_TIMELINE_RULES;
  const base: ServiceTimelineRules = config
    ? {
        documentVerificationHours: config.documentVerificationHours,
        expectedCompletionHours: config.expectedCompletionHours,
        quotationResponseMinutes: config.quotationResponseMinutes,
        paymentDeadlineHours: config.paymentDeadlineHours,
        followUpIntervalDays: config.followUpIntervalDays,
        minTravelDaysNormal: config.minTravelDaysNormal,
        minTravelDaysExpress: config.minTravelDaysExpress,
        processingDaysNormal: config.processingDaysNormal,
        processingDaysExpress: config.processingDaysExpress,
        autoCompleteAfterDays: config.autoCompleteAfterDays,
      }
    : EMPTY_TIMELINE_RULES;
  if (!countryId || !isCountryTimelineService(serviceType)) return base;
  const override = await db.serviceCountryTimeline.findUnique({ where: { serviceType_countryId: { serviceType, countryId } } });
  return mergeTimelineRules(base, override ? pickOverride(override) : null);
}

/** Every country override for the given services, keyed `${serviceType}:${countryId}` (one query, for bulk readers like delays.ts). */
export async function getCountryTimelineOverrides(serviceTypes: readonly ServiceType[]): Promise<Map<string, CountryTimelineOverride>> {
  const services = serviceTypes.filter(isCountryTimelineService);
  const result = new Map<string, CountryTimelineOverride>();
  if (services.length === 0) return result;
  const rows = await db.serviceCountryTimeline.findMany({ where: { serviceType: { in: services } } });
  for (const row of rows) result.set(`${row.serviceType}:${row.countryId}`, pickOverride(row));
  return result;
}

function pickOverride(row: CountryTimelineOverride): CountryTimelineOverride {
  return Object.fromEntries(COUNTRY_TIMELINE_FIELDS.map((field) => [field, row[field]])) as CountryTimelineOverride;
}
