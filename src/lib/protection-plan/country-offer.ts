import type { Prisma } from "../../generated/prisma/client";
import { db } from "../db";
import { PROTECTION_PLAN_CONFIG_ID, FALLBACK_DEFAULT_PRICE } from "../settings/protection-plan-config";

export interface ProtectionPlanOffer {
  countryId: string;
  price: number;
  termsText: string;
  eligibilityConditions: string[];
}

type Client = Prisma.TransactionClient | typeof db;

/**
 * P12 — client confirmed: Protection Plan is offered only where Admin enabled
 * it for the destination country. Returns null (no offer, no ProtectionPlan
 * rows) when the country is unknown, has no row, or is disabled. Price and
 * terms fall back to the global ProtectionPlanConfig when left empty.
 */
export async function getProtectionPlanOffer(countryCode: string | null | undefined, client: Client = db): Promise<ProtectionPlanOffer | null> {
  if (!countryCode) return null;
  const row = await client.protectionPlanCountry.findFirst({
    where: { enabled: true, country: { code: { equals: countryCode, mode: "insensitive" } } },
  });
  if (!row) return null;

  const config = await client.protectionPlanConfig.findUnique({ where: { id: PROTECTION_PLAN_CONFIG_ID } });
  const price = row.price != null ? Number(row.price) : config ? Number(config.defaultPrice) : FALLBACK_DEFAULT_PRICE;
  const conditions = Array.isArray(config?.eligibilityConditions) ? (config.eligibilityConditions as unknown[]).filter((c): c is string => typeof c === "string") : [];

  return {
    countryId: row.countryId,
    price,
    termsText: row.termsText?.trim() || config?.termsText || "",
    eligibilityConditions: conditions,
  };
}

/**
 * The ProtectionPlan rows for a new New Visa booking, or none when the plan
 * isn't enabled for the destination. Passengers the customer opted in for on
 * the application form (terms accepted there, kept in the lead's details as
 * `protectionPlanPassengerIds` / `protectionPlanTermsAcceptedAt`) start as
 * TERMS_ACCEPTED and are charged with the booking's payment; everyone else is
 * OFFERED so staff can still add it later.
 */
export function protectionPlanRowsForBooking(input: {
  bookingId: string;
  passengerIds: string[];
  offer: ProtectionPlanOffer | null;
  leadDetails: unknown;
}) {
  const { bookingId, passengerIds, offer } = input;
  if (!offer || passengerIds.length === 0) return { rows: [], chosen: 0 };
  const details = (input.leadDetails ?? {}) as Record<string, unknown>;
  const chosenIds = new Set(Array.isArray(details.protectionPlanPassengerIds) ? (details.protectionPlanPassengerIds as unknown[]).filter((id): id is string => typeof id === "string") : []);
  const acceptedAtRaw = typeof details.protectionPlanTermsAcceptedAt === "string" ? new Date(details.protectionPlanTermsAcceptedAt) : null;
  const acceptedAt = acceptedAtRaw && !Number.isNaN(acceptedAtRaw.getTime()) ? acceptedAtRaw : null;

  const rows = passengerIds.map((passengerId) => {
    const chosen = acceptedAt !== null && chosenIds.has(passengerId);
    return {
      bookingId,
      passengerId,
      status: chosen ? ("TERMS_ACCEPTED" as const) : ("OFFERED" as const),
      price: offer.price,
      termsAcceptedAt: chosen ? acceptedAt : null,
    };
  });
  return { rows, chosen: rows.filter((row) => row.status === "TERMS_ACCEPTED").length };
}

/** New Visa leads keep their destination as a country code in `details.destinationCountry`. */
export function leadDestinationCountryCode(serviceType: string, details: unknown): string | null {
  if (serviceType !== "NEW_VISA") return null;
  const value = (details as Record<string, unknown> | null)?.destinationCountry;
  return typeof value === "string" && value ? value : null;
}
