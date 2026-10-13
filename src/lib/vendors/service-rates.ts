import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client";

/** Client doc 2026-10-14 — the services a vendor rate by country / airline / processing type applies to. */
export const VENDOR_RATE_SERVICES = ["OTB", "RETURN_TICKET"] as const;
export type VendorRateService = (typeof VENDOR_RATE_SERVICES)[number];

const optionalId = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional();

export const createVendorServiceRateSchema = z.object({
  vendorId: z.string().min(1, "Select a vendor"),
  serviceType: z.enum(VENDOR_RATE_SERVICES, { error: "Select OTB or Return Ticket" }),
  countryId: z.string().min(1, "Select a country"),
  /** Blank = any airline. */
  airlineId: optionalId,
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
    cost: Number(row.cost),
    active: row.active,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface VendorRateCandidate {
  airlineId: string | null;
  processingType: string | null;
  cost: unknown;
}

/**
 * The most specific active rate for a booking: an exact airline beats "any
 * airline", an exact processing type beats "any". Rows passed in must already
 * be the vendor's active rates for the service and country. Null = none.
 */
export function pickVendorRate<T extends VendorRateCandidate>(rows: T[], airlineId: string | null, processingType: string | null): T | null {
  const fits = rows.filter(
    (row) => (row.airlineId === null || row.airlineId === airlineId) && (row.processingType === null || row.processingType === processingType)
  );
  fits.sort((a, b) => Number(b.airlineId !== null) * 2 + Number(b.processingType !== null) - (Number(a.airlineId !== null) * 2 + Number(a.processingType !== null)));
  return fits[0] ?? null;
}
