import { db } from "../db";
import type { PaxType } from "../../generated/prisma/enums";
import type { OtbProcessingType } from "./processing-rules";

export const OTB_PAX_TYPES: PaxType[] = ["ADULT", "CHILD", "INFANT"];

export function serializeOtbPrice(row: {
  id: string;
  airlineId: string;
  countryId: string;
  paxType: PaxType;
  normalPrice: { toString(): string };
  urgentPrice: { toString(): string } | null;
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
    active: row.active,
  };
}

/**
 * P18 — Developer Answers §4: the OTB price per applicant comes from the
 * Admin OtbPrice row for airline + destination country + passenger type;
 * with no active row (or no urgent price on it) the airline's own
 * normal/urgent price applies. Returns one price per applicant, in order;
 * null means no price is configured anywhere for that applicant.
 */
export async function resolveOtbApplicantPrices(input: {
  airline: { id: string; normalPrice: unknown; urgentPrice: unknown };
  countryCode: string;
  processingType: OtbProcessingType;
  paxTypes: PaxType[];
}): Promise<(number | null)[]> {
  const rows = await db.otbPrice.findMany({
    where: {
      airlineId: input.airline.id,
      active: true,
      country: { code: { equals: input.countryCode, mode: "insensitive" } },
    },
    select: { paxType: true, normalPrice: true, urgentPrice: true },
  });
  const airlinePrice = input.processingType === "urgent" ? input.airline.urgentPrice : input.airline.normalPrice;
  const fallback = airlinePrice === null || airlinePrice === undefined ? null : Number(airlinePrice);
  return input.paxTypes.map((paxType) => {
    const row = rows.find((r) => r.paxType === paxType);
    const price = row ? (input.processingType === "urgent" ? row.urgentPrice : row.normalPrice) : null;
    return price === null || price === undefined ? fallback : Number(price);
  });
}
