import { z } from "zod";
import { ServiceType } from "../../generated/prisma/enums";
import { sensitiveReasonSchema } from "./sensitive-action";
import { COPYABLE_SERVICE_TIMELINE_FIELDS, COUNTRY_TIMELINE_SERVICES } from "../settings/service-timeline-merge";

/**
 * Admin handover §6 — per-country timelines (ServiceCountryTimeline) and the
 * "Copy these timelines to…" bulk apply. Shared by the Admin UI and the
 * routes. Limits match service-timeline-config-schema.ts.
 */
const hours = z.number().int("Enter whole hours").min(0, "Can't be negative").max(8760, "That's too long").nullable();
const minutes = z.number().int("Enter whole minutes").min(0, "Can't be negative").max(525600, "That's too long").nullable();
const days = z.number().int("Enter whole days").min(0, "Can't be negative").max(90, "At most 90 days").nullable();

export const countryTimelineServiceSchema = z.enum(COUNTRY_TIMELINE_SERVICES);

export const countryTimelineValuesSchema = z.object({
  documentVerificationHours: hours,
  expectedCompletionHours: hours,
  quotationResponseMinutes: minutes,
  paymentDeadlineHours: hours,
  processingDaysNormal: days,
  processingDaysExpress: days,
});
export type CountryTimelineValues = z.infer<typeof countryTimelineValuesSchema>;

export const upsertCountryTimelineSchema = countryTimelineValuesSchema.extend({
  serviceType: countryTimelineServiceSchema,
  countryId: z.string().min(1, "Choose a country"),
  reason: sensitiveReasonSchema,
});

/** Copy one service's shared timeline fields to other services. */
const copyServiceSchema = z.object({
  mode: z.literal("SERVICE"),
  sourceServiceType: z.enum(ServiceType),
  targetServiceTypes: z.array(z.enum(ServiceType)).min(1, "Choose at least one service").max(20),
  reason: sensitiveReasonSchema,
});

/** Copy one country timeline to other countries and/or the same country of other country-timeline services. */
const copyCountrySchema = z.object({
  mode: z.literal("COUNTRY"),
  sourceServiceType: countryTimelineServiceSchema,
  sourceCountryId: z.string().min(1),
  targetServiceTypes: z.array(countryTimelineServiceSchema).min(1, "Choose at least one service").max(COUNTRY_TIMELINE_SERVICES.length),
  targetCountryIds: z.array(z.string().min(1)).min(1, "Choose at least one country").max(300),
  reason: sensitiveReasonSchema,
});

export const copyTimelinesSchema = z.discriminatedUnion("mode", [copyServiceSchema, copyCountrySchema]);
export type CopyTimelinesInput = z.infer<typeof copyTimelinesSchema>;

export { COPYABLE_SERVICE_TIMELINE_FIELDS };
