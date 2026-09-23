import { db } from "../db";
import type { PaxType } from "../../generated/prisma/enums";

export interface NewVisaPriceBreakdown {
  ratePerType: { adultPrice: number; childPrice: number; infantPrice: number };
  travellerCount: number;
  total: number;
}

/**
 * Auto-computes the New Visa total from Admin-configured `NewVisaPricing`
 * (country + Normal/Express, separate Adult/Child/Infant rates — see the
 * model's own doc comment for why visaType isn't a pricing dimension).
 * Returns null when no rate is configured for this country+processingType,
 * so the caller can fail safe (no payment created, no price guessed) rather
 * than silently charging ₹0 or fabricating a number.
 */
export async function computeNewVisaPrice(input: {
  countryCode: string;
  processingType: "normal" | "urgent";
  travellerPaxTypes: PaxType[];
}): Promise<NewVisaPriceBreakdown | null> {
  const country = await db.country.findUnique({ where: { code: input.countryCode } });
  if (!country) return null;

  const rule = await db.newVisaPricing.findFirst({
    where: { countryId: country.id, processingType: input.processingType, active: true, country: { active: true } },
  });
  if (!rule) return null;

  const ratePerType = {
    adultPrice: Number(rule.adultPrice),
    childPrice: Number(rule.childPrice),
    infantPrice: Number(rule.infantPrice),
  };

  const rateFor = (paxType: PaxType) =>
    paxType === "ADULT" ? ratePerType.adultPrice : paxType === "CHILD" ? ratePerType.childPrice : ratePerType.infantPrice;

  const total = input.travellerPaxTypes.reduce((sum, paxType) => sum + rateFor(paxType), 0);

  return { ratePerType, travellerCount: input.travellerPaxTypes.length, total };
}
