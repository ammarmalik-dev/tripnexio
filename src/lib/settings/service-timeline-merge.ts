import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Admin handover §6 "one central Timeline Control … configured by service,
 * country …". Pure (no DB / server imports) so the Admin UI, the reader in
 * service-timeline-config.ts and vitest share one definition.
 */

export interface ServiceTimelineRules {
  documentVerificationHours: number | null;
  expectedCompletionHours: number | null;
  quotationResponseMinutes: number | null;
  paymentDeadlineHours: number | null;
  followUpIntervalDays: number | null;
  minTravelDaysNormal: number | null;
  minTravelDaysExpress: number | null;
  /** Client corrections 2026-10-05 — New Visa processing working days (Expected Approval Date). */
  processingDaysNormal: number | null;
  processingDaysExpress: number | null;
  /** P17 — Return Ticket: days after travel before a delivered booking auto-completes. */
  autoCompleteAfterDays: number | null;
}

export const EMPTY_TIMELINE_RULES: ServiceTimelineRules = {
  documentVerificationHours: null,
  expectedCompletionHours: null,
  quotationResponseMinutes: null,
  paymentDeadlineHours: null,
  followUpIntervalDays: null,
  minTravelDaysNormal: null,
  minTravelDaysExpress: null,
  processingDaysNormal: null,
  processingDaysExpress: null,
  autoCompleteAfterDays: null,
};

/**
 * Services whose timelines can be set per country (ServiceCountryTimeline).
 * New Visa keeps its own NewVisaCountryTimeline and OTB its per-airline TAT.
 */
export const COUNTRY_TIMELINE_SERVICES = ["RETURN_TICKET", "VISA_EXTENSION", "VISA_CHANGE", "FLIGHT_SPECIAL_FARE"] as const satisfies readonly ServiceType[];
export type CountryTimelineService = (typeof COUNTRY_TIMELINE_SERVICES)[number];

export function isCountryTimelineService(serviceType: ServiceType): serviceType is CountryTimelineService {
  return (COUNTRY_TIMELINE_SERVICES as readonly ServiceType[]).includes(serviceType);
}

/** The ServiceCountryTimeline columns a country can override (null = use the service value). */
export const COUNTRY_TIMELINE_FIELDS = [
  "documentVerificationHours",
  "expectedCompletionHours",
  "quotationResponseMinutes",
  "paymentDeadlineHours",
  "processingDaysNormal",
  "processingDaysExpress",
] as const;
export type CountryTimelineField = (typeof COUNTRY_TIMELINE_FIELDS)[number];
export type CountryTimelineOverride = Record<CountryTimelineField, number | null>;

/** The service-wide fields "Copy these timelines to…" copies between services (the ones every service shares). */
export const COPYABLE_SERVICE_TIMELINE_FIELDS = [
  "documentVerificationHours",
  "expectedCompletionHours",
  "quotationResponseMinutes",
  "paymentDeadlineHours",
  "followUpIntervalDays",
] as const;
export type CopyableServiceTimelineField = (typeof COPYABLE_SERVICE_TIMELINE_FIELDS)[number];

/** Service default + country override: each override field that is set wins, every other field keeps the service value. */
export function mergeTimelineRules(base: ServiceTimelineRules, override: Partial<CountryTimelineOverride> | null | undefined): ServiceTimelineRules {
  if (!override) return base;
  const merged: ServiceTimelineRules = { ...base };
  for (const field of COUNTRY_TIMELINE_FIELDS) {
    const value = override[field];
    if (value !== null && value !== undefined) merged[field] = value;
  }
  return merged;
}

/** One ServiceCountryTimeline row as the Admin API returns it. */
export interface CountryTimelineRow extends CountryTimelineOverride {
  id: string;
  countryId: string;
  countryCode: string;
  countryName: string;
  updatedAt: string;
}

export const COUNTRY_TIMELINE_FIELD_META: Record<CountryTimelineField, { label: string; unit: string }> = {
  documentVerificationHours: { label: "Document verification", unit: "h" },
  expectedCompletionHours: { label: "Expected completion", unit: "h" },
  quotationResponseMinutes: { label: "Quotation response", unit: "min" },
  paymentDeadlineHours: { label: "Payment deadline", unit: "h" },
  processingDaysNormal: { label: "Processing Normal", unit: "days" },
  processingDaysExpress: { label: "Processing Express", unit: "days" },
};

/** "Expected completion 48 h, Payment deadline default, …" — audit summary of one country row. */
export function describeCountryTimeline(values: CountryTimelineOverride): string {
  return COUNTRY_TIMELINE_FIELDS.map((field) => {
    const { label, unit } = COUNTRY_TIMELINE_FIELD_META[field];
    return `${label} ${values[field] === null ? "default" : `${values[field]} ${unit}`}`;
  }).join(", ");
}
