import type { Prisma } from "../../generated/prisma/client";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Client corrections 2026-10-05 — the Country / Travel Date / PAX columns
 * on Lead, copied out of the intake `details` so lists can show and filter
 * them. Same rules as the backfill in migration 20261005120000_lead_list_facts.
 */
export interface LeadListFacts {
  countryId: string | null;
  travelDate: Date | null;
  paxCount: number | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayLength(value: unknown): number | null {
  return Array.isArray(value) && value.length > 0 ? value.length : null;
}

/** Visa Extension / Visa Change are UAE visas (by Admin country code or name). */
async function uaeCountryId(tx: Prisma.TransactionClient): Promise<string | null> {
  const country = await tx.country.findFirst({
    where: { OR: [{ code: { in: ["ARE", "AE", "UAE"], mode: "insensitive" } }, { name: { equals: "United Arab Emirates", mode: "insensitive" } }] },
    select: { id: true },
  });
  return country?.id ?? null;
}

/** A Special Fare city / airport text ("DXB", "Dubai", "Dubai International") → that airport's country. */
async function airportCountryId(tx: Prisma.TransactionClient, text: unknown): Promise<string | null> {
  if (typeof text !== "string" || !text.trim()) return null;
  const value = text.trim();
  const code = /\(([A-Za-z]{3})\)/.exec(value)?.[1] ?? (/^[A-Za-z]{3}$/.test(value) ? value : null);
  const airport = await tx.airport.findFirst({
    where: code
      ? { code: { equals: code, mode: "insensitive" } }
      : { OR: [{ city: { equals: value, mode: "insensitive" } }, { name: { equals: value, mode: "insensitive" } }] },
    select: { countryId: true },
  });
  return airport?.countryId ?? null;
}

export async function leadListFacts(tx: Prisma.TransactionClient, rawDetails: unknown, serviceType?: ServiceType): Promise<LeadListFacts> {
  const details = record(rawDetails);

  const travel = typeof details.travelDate === "string" ? details.travelDate.slice(0, 10) : "";
  const travelDate = /^\d{4}-\d{2}-\d{2}$/.test(travel) ? new Date(`${travel}T00:00:00Z`) : null;

  const travelers = typeof details.travelers === "string" && /^\d+$/.test(details.travelers) ? Number(details.travelers) : null;
  const paxCount =
    arrayLength(details.passengerIds) ?? travelers ?? arrayLength(details.applicants) ?? arrayLength(details.passengers);

  let countryId: string | null = null;
  if (typeof details.destinationCountry === "string" && details.destinationCountry) {
    countryId = (await tx.country.findUnique({ where: { code: details.destinationCountry }, select: { id: true } }))?.id ?? null;
  }
  if (!countryId && typeof details.destinationCountryId === "string" && details.destinationCountryId) {
    countryId = (await tx.country.findUnique({ where: { id: details.destinationCountryId }, select: { id: true } }))?.id ?? null;
  }

  // Client doc 2026-10-15 (C3) — every service shows a country flag: Visa Extension / Change are UAE visas;
  // a flight shows its destination's country (so a domestic flight within India shows India).
  if (!countryId && (serviceType === "VISA_EXTENSION" || serviceType === "VISA_CHANGE")) countryId = await uaeCountryId(tx);
  if (!countryId && serviceType === "FLIGHT_SPECIAL_FARE") {
    countryId = (await airportCountryId(tx, details.toAirportCode)) ?? (await airportCountryId(tx, details.destination));
  }

  return { countryId, travelDate, paxCount };
}
