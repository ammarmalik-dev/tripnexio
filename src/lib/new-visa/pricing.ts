import { db } from "../db";
import type { PaxType } from "../../generated/prisma/enums";

export interface NewVisaPriceBreakdown {
  ratePerType: { adultPrice: number; childPrice: number; infantPrice: number };
  travellerCount: number;
  total: number;
  /** Step 40 — summed from PricingRule.vendorCost across all travellers, so New Visa's auto-checkout can finally record a real margin instead of always defaulting to 0. */
  vendorCost: number;
}

/**
 * Step 40 (Admin FINAL handover §4): reads the central `PricingRule` table
 * — replaces the retired `NewVisaPricing` model. One row per
 * (NEW_VISA, country, processingType, paxType) with `nationality: null`
 * (New Visa's own form never asks nationality, so only the catch-all rows
 * apply). Returns `null` — never a guessed/fallback price — if any
 * traveller's paxType has no configured rule, matching the old function's
 * fail-safe behavior exactly.
 */
export async function computeNewVisaPrice(input: {
  countryCode: string;
  processingType: "normal" | "urgent";
  travellerPaxTypes: PaxType[];
}): Promise<NewVisaPriceBreakdown | null> {
  const country = await db.country.findUnique({ where: { code: input.countryCode } });
  if (!country) return null;

  const uniquePaxTypes = [...new Set(input.travellerPaxTypes)];
  const rules = await db.pricingRule.findMany({
    where: {
      serviceType: "NEW_VISA",
      countryId: country.id,
      processingType: input.processingType,
      paxType: { in: uniquePaxTypes },
      nationality: null,
      active: true,
      country: { active: true },
    },
  });

  const ruleFor = (paxType: PaxType) => rules.find((rule) => rule.paxType === paxType);
  if (uniquePaxTypes.some((paxType) => !ruleFor(paxType))) return null;

  const rateFor = (paxType: PaxType) => {
    const rule = ruleFor(paxType)!;
    return Number(rule.sellingPrice) + Number(rule.additionalCharges);
  };
  const vendorCostFor = (paxType: PaxType) => Number(ruleFor(paxType)!.vendorCost);

  const ratePerType = {
    adultPrice: uniquePaxTypes.includes("ADULT") ? rateFor("ADULT") : 0,
    childPrice: uniquePaxTypes.includes("CHILD") ? rateFor("CHILD") : 0,
    infantPrice: uniquePaxTypes.includes("INFANT") ? rateFor("INFANT") : 0,
  };

  let total = 0;
  let vendorCost = 0;
  for (const paxType of input.travellerPaxTypes) {
    total += rateFor(paxType);
    vendorCost += vendorCostFor(paxType);
  }

  return { ratePerType, travellerCount: input.travellerPaxTypes.length, total, vendorCost };
}
