import { db } from "../db";
import type { VendorScoringWeights } from "./score-formula";

export { computeVendorScore, type VendorScoringWeights, type VendorScoredFields } from "./score-formula";

/** Business Rules §8 "Vendor Selection" — singleton weights row, same pattern as TaxFeeConfig. */
export const VENDOR_SCORING_CONFIG_ID = "singleton";

const FALLBACK_WEIGHTS: VendorScoringWeights = {
  serviceSuitabilityWeight: 25,
  processingTimeWeight: 25,
  performanceWeight: 25,
  reliabilityWeight: 25,
};

/** Reads the current admin-configured weights — falls back to equal weighting if the seeded singleton row is somehow missing. Server-only (DB access) — see score-formula.ts for the client-safe pure formula. */
export async function getVendorScoringWeights(): Promise<VendorScoringWeights> {
  const config = await db.vendorScoringConfig.findUnique({ where: { id: VENDOR_SCORING_CONFIG_ID } });
  if (!config) return FALLBACK_WEIGHTS;
  return {
    serviceSuitabilityWeight: config.serviceSuitabilityWeight,
    processingTimeWeight: config.processingTimeWeight,
    performanceWeight: config.performanceWeight,
    reliabilityWeight: config.reliabilityWeight,
  };
}
