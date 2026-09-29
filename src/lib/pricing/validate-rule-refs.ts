import { db } from "../db";
import { jsonError } from "../api/respond";
import type { ServiceType } from "../../generated/prisma/enums";

/** The legacy processing codes every service accepted before the P23 Processing Types master existed. */
const LEGACY_PROCESSING_CODES = ["normal", "urgent"];

/**
 * P23 — server-side checks for a pricing rule's optional sub-service, visa
 * type and processing type (the effective values after merging an update
 * onto the existing row):
 *   - the sub-service must exist and belong to the rule's own service;
 *   - the visa type must exist, and a country-specific visa type must match
 *     the rule's country (when the rule has one);
 *   - the processing code must be one of that service's configured
 *     Processing Types, or — for a service with none configured yet — one of
 *     the legacy "normal"/"urgent" codes.
 * Pass `check*` false to skip a reference the caller didn't change (so an
 * unrelated edit to an older row never fails on a since-retired option).
 */
export async function validatePricingRuleRefs(input: {
  serviceType: ServiceType;
  countryId: string | null;
  subServiceId: string | null;
  visaTypeId: string | null;
  processingType: string | null;
  checkSubService: boolean;
  checkVisaType: boolean;
  checkProcessingType: boolean;
}): Promise<Response | null> {
  if (input.subServiceId && input.checkSubService) {
    const subService = await db.subService.findUnique({ where: { id: input.subServiceId }, select: { serviceType: true } });
    if (!subService) return jsonError(400, "Sub-service not found.", { subServiceId: ["Select a valid sub-service."] });
    if (subService.serviceType !== input.serviceType) {
      return jsonError(400, "That sub-service belongs to a different service.", { subServiceId: ["Pick a sub-service of this rule's service."] });
    }
  }

  if (input.visaTypeId && input.checkVisaType) {
    const visaType = await db.visaType.findUnique({ where: { id: input.visaTypeId }, select: { countryId: true } });
    if (!visaType) return jsonError(400, "Visa type not found.", { visaTypeId: ["Select a valid visa type."] });
    if (visaType.countryId && input.countryId && visaType.countryId !== input.countryId) {
      return jsonError(400, "That visa type belongs to a different country.", { visaTypeId: ["Pick a visa type offered for this rule's country."] });
    }
  }

  if (input.processingType && input.checkProcessingType) {
    const options = await db.processingTypeOption.findMany({ where: { serviceType: input.serviceType }, select: { code: true } });
    const allowed = options.length > 0 ? options.map((option) => option.code) : LEGACY_PROCESSING_CODES;
    if (!allowed.includes(input.processingType)) {
      return jsonError(400, "Processing type not configured for this service.", { processingType: ["Select a processing type configured for this service."] });
    }
  }

  return null;
}
