import type { z } from "zod";
import { db } from "../db";
import { jsonError } from "../api/respond";
import type { createVendorServiceRateSchema } from "./service-rates";

type RateInput = z.infer<typeof createVendorServiceRateSchema>;

/**
 * Client doc 2026-10-14 / 16 Nov (K9) — one vendor rate's fields, cleaned per service and checked against the
 * masters, shared by Add and Edit (every column is editable). `exceptId` = the rate being edited (not a duplicate
 * of itself). Returns the data to save, or an error response.
 */
export async function prepareVendorRate(input: RateInput, exceptId?: string) {
  const isNewVisa = input.serviceType === "NEW_VISA";
  const data = {
    ...input,
    airlineId: input.serviceType === "OTB" ? (input.airlineId ?? null) : null,
    nationalityId: isNewVisa ? (input.nationalityId ?? null) : null,
    paxType: isNewVisa && input.paxType ? input.paxType : null,
    newVisaConfigId: isNewVisa ? (input.newVisaConfigId ?? null) : null,
    processingType: input.processingType || null,
  };
  const vendor = await db.vendor.findUnique({ where: { id: data.vendorId }, select: { id: true } });
  if (!vendor) return { error: jsonError(400, "Vendor not found.", { vendorId: ["Select a valid vendor."] }) };
  const country = await db.country.findUnique({ where: { id: data.countryId }, select: { id: true } });
  if (!country) return { error: jsonError(400, "Country not found.", { countryId: ["Select a valid country."] }) };
  if (data.airlineId && !(await db.airline.findUnique({ where: { id: data.airlineId }, select: { id: true } }))) {
    return { error: jsonError(400, "Airline not found.", { airlineId: ["Select a valid airline."] }) };
  }
  if (data.nationalityId && !(await db.nationality.findUnique({ where: { id: data.nationalityId }, select: { id: true } }))) {
    return { error: jsonError(400, "Nationality not found.", { nationalityId: ["Select a valid nationality."] }) };
  }
  // Client doc 2026-10-27 (E2) — the visa option must be one of this country's New Visa options.
  if (data.newVisaConfigId && !(await db.newVisaCountryConfig.findFirst({ where: { id: data.newVisaConfigId, countryId: data.countryId }, select: { id: true } }))) {
    return { error: jsonError(400, "Visa type not found for this country.", { newVisaConfigId: ["Select one of this country's visa options."] }) };
  }
  const duplicate = await db.vendorServiceRate.findFirst({
    where: {
      vendorId: data.vendorId,
      serviceType: data.serviceType,
      countryId: data.countryId,
      airlineId: data.airlineId,
      nationalityId: data.nationalityId,
      paxType: data.paxType,
      newVisaConfigId: data.newVisaConfigId,
      processingType: data.processingType,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) return { error: jsonError(400, "This vendor already has this rate — edit that one instead.", { countryId: ["Already added."] }) };
  return { data };
}
