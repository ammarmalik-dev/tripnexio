import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { computeNewVisaPrice } from "@/lib/new-visa/pricing";
import type { PaxType } from "@/generated/prisma/enums";

const MAX_TRAVELLERS = 9;

/**
 * Public, unauthenticated price preview for the New Visa landing page's
 * product-card selector — "Price: configured price for selected product +
 * traveller quantities" (client's own locked copy). Wraps the exact same
 * `computeNewVisaPrice()` the real lead-intake route uses, so a preview
 * price can never drift from what the customer is actually charged.
 * Returns `configured: false` (never a guessed/fallback number) when no
 * `PricingRule` covers the request — same fail-safe as the underlying
 * function, per CLAUDE.md's "never invent domain data" rule.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const countryCode = searchParams.get("countryCode");
  const processingTypeParam = searchParams.get("processingType");
  const adults = Number(searchParams.get("adults") ?? "0");
  const children = Number(searchParams.get("children") ?? "0");
  const infants = Number(searchParams.get("infants") ?? "0");

  if (!countryCode) return jsonError(400, "countryCode is required.");
  if (processingTypeParam !== "normal" && processingTypeParam !== "urgent") {
    return jsonError(400, "processingType must be 'normal' or 'urgent'.");
  }
  if ([adults, children, infants].some((count) => !Number.isInteger(count) || count < 0)) {
    return jsonError(400, "adults/children/infants must be non-negative whole numbers.");
  }
  const totalTravellers = adults + children + infants;
  if (totalTravellers === 0) {
    return jsonSuccess({ configured: false });
  }
  if (totalTravellers > MAX_TRAVELLERS) {
    return jsonError(400, `Total travellers can't exceed ${MAX_TRAVELLERS}.`);
  }

  const travellerPaxTypes: PaxType[] = [
    ...Array<PaxType>(adults).fill("ADULT"),
    ...Array<PaxType>(children).fill("CHILD"),
    ...Array<PaxType>(infants).fill("INFANT"),
  ];

  const breakdown = await computeNewVisaPrice({ countryCode, processingType: processingTypeParam, travellerPaxTypes });
  if (!breakdown) return jsonSuccess({ configured: false });

  return jsonSuccess({ configured: true, total: breakdown.total, ratePerType: breakdown.ratePerType });
}
