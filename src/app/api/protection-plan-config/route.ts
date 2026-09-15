import { jsonSuccess, jsonError } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { PROTECTION_PLAN_CONFIG_ID } from "@/lib/settings/protection-plan-config";

/**
 * Public, unauthenticated — the New Visa customer request flow reads this
 * to show the current price/terms/eligibility conditions before the
 * customer expresses interest. Deliberately narrower than the Admin route:
 * no timestamps, nothing internal.
 */
export async function GET() {
  const config = await db.protectionPlanConfig.findUnique({ where: { id: PROTECTION_PLAN_CONFIG_ID } });
  if (!config) return jsonError(404, "Protection Plan is not configured yet.");

  return jsonSuccess({
    defaultPrice: config.defaultPrice,
    termsText: config.termsText,
    eligibilityConditions: config.eligibilityConditions,
  });
}
