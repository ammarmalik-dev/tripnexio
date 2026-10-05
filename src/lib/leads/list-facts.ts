import type { Prisma } from "../../generated/prisma/client";

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

export async function leadListFacts(tx: Prisma.TransactionClient, rawDetails: unknown): Promise<LeadListFacts> {
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

  return { countryId, travelDate, paxCount };
}
