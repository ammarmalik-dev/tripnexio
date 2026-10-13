import { db } from "../db";
import type { PaxType } from "../../generated/prisma/enums";
import type { OtbProcessingType } from "./processing-rules";

export function serializeOtbPrice(row: {
  id: string;
  airlineId: string;
  countryId: string;
  paxType: PaxType;
  normalPrice: { toString(): string };
  urgentPrice: { toString(): string } | null;
  airlineFee: { toString(): string };
  active: boolean;
  airline: { name: string; code: string };
  country: { name: string; code: string };
}) {
  return {
    id: row.id,
    airlineId: row.airlineId,
    airlineName: row.airline.name,
    airlineCode: row.airline.code,
    countryId: row.countryId,
    countryName: row.country.name,
    countryCode: row.country.code,
    paxType: row.paxType,
    normalPrice: Number(row.normalPrice),
    urgentPrice: row.urgentPrice === null ? null : Number(row.urgentPrice),
    airlineFee: Number(row.airlineFee),
    active: row.active,
  };
}

/**
 * The one OTB price row for an airline + destination country. Client reply
 * 2026-10-13: OTB has one rate for every passenger (no Adult / Child / Infant)
 * and is priced only per country × airline — the airline-level price and its
 * fallback are gone. Rows are kept as passenger type ADULT; an older Child /
 * Infant row is used only when no ADULT row exists.
 */
export async function getOtbCountryPrice(airlineId: string, countryCode: string) {
  const rows = await db.otbPrice.findMany({
    where: { airlineId, active: true, country: { code: { equals: countryCode, mode: "insensitive" } } },
    select: { paxType: true, normalPrice: true, urgentPrice: true, airlineFee: true },
  });
  return rows.find((row) => row.paxType === "ADULT") ?? rows[0] ?? null;
}

/** Urgent is offered only when the country price has an urgent amount. */
export async function otbUrgentAvailable(airlineId: string, countryCode: string): Promise<boolean> {
  const row = await getOtbCountryPrice(airlineId, countryCode);
  return row?.urgentPrice !== null && row?.urgentPrice !== undefined;
}

/**
 * The OTB price per applicant: the same country × airline price for everyone.
 * Returns one entry per applicant, in order; price null = not configured.
 */
export async function resolveOtbApplicantPrices(input: {
  airline: { id: string };
  countryCode: string;
  processingType: OtbProcessingType;
  paxTypes: PaxType[];
}): Promise<{ price: number | null; airlineFee: number }[]> {
  const row = await getOtbCountryPrice(input.airline.id, input.countryCode);
  const price = row ? (input.processingType === "urgent" ? row.urgentPrice : row.normalPrice) : null;
  return input.paxTypes.map(() =>
    price === null || price === undefined ? { price: null, airlineFee: 0 } : { price: Number(price), airlineFee: Number(row!.airlineFee) }
  );
}
