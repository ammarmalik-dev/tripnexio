import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";

/**
 * Client doc 2026-10-14 — the services a vendor rate by country / airline / processing type applies to.
 * Client doc 2026-10-15 — New Visa too, by country / nationality / Adult or Child / processing type.
 */
export const VENDOR_RATE_SERVICES = ["OTB", "RETURN_TICKET", "NEW_VISA"] as const;
export type VendorRateService = (typeof VENDOR_RATE_SERVICES)[number];

const optionalId = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const createVendorServiceRateSchema = z.object({
  vendorId: z.string().min(1, "Select a vendor"),
  serviceType: z.enum(VENDOR_RATE_SERVICES, { error: "Select a service" }),
  countryId: z.string().min(1, "Select a country"),
  /** Blank = any airline (OTB only). */
  airlineId: optionalId,
  /** New Visa only — blank = any nationality. */
  nationalityId: optionalId,
  /** New Visa only — blank = any passenger. */
  paxType: z.enum(["ADULT", "CHILD", ""]).optional(),
  /** "normal" / "urgent"; blank = any. */
  processingType: z.enum(["normal", "urgent", ""]).optional(),
  cost: z.number({ error: "Enter the cost" }).min(0, "Cost can't be negative").max(10_000_000, "Cost is too large"),
  active: z.boolean().default(true),
});

export const updateVendorServiceRateSchema = z.object({
  cost: z.number().min(0, "Cost can't be negative").max(10_000_000, "Cost is too large").optional(),
  active: z.boolean().optional(),
});

export const VENDOR_RATE_INCLUDE = {
  vendor: { select: { name: true } },
  country: { select: { name: true, code: true } },
  airline: { select: { name: true, code: true } },
  nationality: { select: { name: true } },
} as const;

export function serializeVendorServiceRate(row: Prisma.VendorServiceRateGetPayload<{ include: typeof VENDOR_RATE_INCLUDE }>) {
  return {
    id: row.id,
    vendorId: row.vendorId,
    vendorName: row.vendor.name,
    serviceType: row.serviceType,
    countryId: row.countryId,
    countryName: row.country.name,
    airlineId: row.airlineId,
    airlineName: row.airline?.name ?? null,
    processingType: row.processingType,
    nationalityId: row.nationalityId,
    nationalityName: row.nationality?.name ?? null,
    paxType: row.paxType,
    cost: Number(row.cost),
    active: row.active,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface VendorRateCandidate {
  airlineId: string | null;
  processingType: string | null;
  nationalityId?: string | null;
  paxType?: string | null;
  cost: unknown;
}

/** What a booking passenger is costed by (New Visa: nationality + Adult / Child). */
export interface VendorRateKeys {
  airlineId?: string | null;
  processingType: string | null;
  nationalityId?: string | null;
  paxType?: string | null;
}

/**
 * The most specific active rate for a booking: an exact airline beats "any
 * airline", an exact nationality beats "any", an exact passenger type beats
 * "any", an exact processing type beats "any". Rows passed in must already be
 * the vendor's active rates for the service and country. Null = none.
 */
export function pickVendorRate<T extends VendorRateCandidate>(rows: T[], keys: VendorRateKeys): T | null {
  const matches = (rowValue: string | null | undefined, wanted: string | null | undefined) => rowValue == null || rowValue === (wanted ?? null);
  const fits = rows.filter(
    (row) =>
      matches(row.airlineId, keys.airlineId) &&
      matches(row.nationalityId, keys.nationalityId) &&
      matches(row.paxType, keys.paxType) &&
      matches(row.processingType, keys.processingType)
  );
  const score = (row: T) =>
    Number(row.airlineId != null) * 8 + Number(row.nationalityId != null) * 4 + Number(row.paxType != null) * 2 + Number(row.processingType != null);
  fits.sort((a, b) => score(b) - score(a));
  return fits[0] ?? null;
}
