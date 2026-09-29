import type { NextRequest } from "next/server";
import { jsonSuccess, jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { PROTECTION_PLAN_CONFIG_ID } from "@/lib/settings/protection-plan-config";
import { getProtectionPlanOffer } from "@/lib/protection-plan/country-offer";

/**
 * Public, unauthenticated — no timestamps, nothing internal.
 *
 * `?country=<code>` (P12, the New Visa summary step): whether Protection Plan
 * is enabled for that destination and, if so, its price, full terms and
 * eligibility conditions. Without `country`, the global defaults (used by the
 * CRM's staff purchase preview).
 */
export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country");
  if (country !== null) {
    const offer = await getProtectionPlanOffer(country.trim().slice(0, 10));
    if (!offer) return jsonSuccess({ enabled: false as const });
    return jsonSuccess({
      enabled: true as const,
      price: offer.price,
      termsText: offer.termsText,
      eligibilityConditions: offer.eligibilityConditions,
    });
  }

  const config = await db.protectionPlanConfig.findUnique({ where: { id: PROTECTION_PLAN_CONFIG_ID } });
  if (!config) return jsonError(404, "Protection Plan is not configured yet.");

  return jsonSuccess({
    defaultPrice: config.defaultPrice,
    termsText: config.termsText,
    eligibilityConditions: config.eligibilityConditions,
  });
}
