/**
 * Pure, client-safe formula — split out of scoring.ts (same reason
 * validity-cap.ts was split from pricing.ts: a DB-backed sibling module
 * pulls `pg` into the browser bundle and breaks the production build).
 * Client components (VendorsManager.tsx) import from here directly.
 */
export interface VendorScoringWeights {
  serviceSuitabilityWeight: number;
  processingTimeWeight: number;
  performanceWeight: number;
  reliabilityWeight: number;
}

export interface VendorScoredFields {
  serviceSuitabilityScore: number;
  processingTimeScore: number;
  performanceScore: number;
  reliabilityScore: number;
}

/**
 * Weighted average of the 4 scored factors (each 1-5), normalized by the sum
 * of weights so they don't need to add up to exactly 100. Returns a number
 * 1-5, rounded to 1 decimal — a sort/display aid only, never used to
 * auto-select a vendor (see the schema's own doc comment on Vendor).
 */
export function computeVendorScore(vendor: VendorScoredFields, weights: VendorScoringWeights): number {
  const totalWeight =
    weights.serviceSuitabilityWeight + weights.processingTimeWeight + weights.performanceWeight + weights.reliabilityWeight;
  if (totalWeight <= 0) return 0;

  const weighted =
    vendor.serviceSuitabilityScore * weights.serviceSuitabilityWeight +
    vendor.processingTimeScore * weights.processingTimeWeight +
    vendor.performanceScore * weights.performanceWeight +
    vendor.reliabilityScore * weights.reliabilityWeight;

  return Math.round((weighted / totalWeight) * 10) / 10;
}
