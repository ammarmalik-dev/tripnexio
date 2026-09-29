import { db } from "../db";
import { jsonError } from "../api/respond";

/**
 * P10 — a pricing rule may target one New Visa product, which must be a
 * New Visa rule for that product's own country.
 */
export async function validatePricingRuleProduct(input: {
  serviceType: string;
  countryId?: string | null;
  newVisaConfigId?: string | null;
}): Promise<Response | null> {
  if (!input.newVisaConfigId) return null;
  if (input.serviceType !== "NEW_VISA") {
    return jsonError(400, "A product can only be set on a New Visa price.", { newVisaConfigId: ["Only for New Visa."] });
  }
  const config = await db.newVisaCountryConfig.findUnique({ where: { id: input.newVisaConfigId }, select: { countryId: true } });
  if (!config) return jsonError(400, "Product not found.", { newVisaConfigId: ["Select a valid product."] });
  if (config.countryId !== input.countryId) {
    return jsonError(400, "The product belongs to a different country.", { newVisaConfigId: ["Pick the rule's country first, then its product."] });
  }
  return null;
}
