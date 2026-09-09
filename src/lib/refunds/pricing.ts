/**
 * Pure refund arithmetic — no service-awareness at all. The old OTB-specific
 * branch that used to live here (`isOtbBooking`/`otbValidated`) moved to
 * src/lib/refunds/rules.ts's evaluateRefundRule(), which now decides
 * `fixedDeduction` (and whether a refund is even allowed) for every
 * service, not just OTB — see that module for the per-service rules (Step
 * 15, audit §7.4).
 */
export interface RefundInput {
  paidAmount: number;
  cancellationCharge: number;
  gatewayCharge: number;
  /** The applicable service-specific rule's mandatory deduction (e.g. OTB/New Visa's ₹250) — always server-computed, never staff-entered. */
  fixedDeduction: number;
}

/** refundAmount = paidAmount - cancellationCharge - gatewayCharge - fixedDeduction, clamped at 0. */
export function computeRefundAmount(input: RefundInput): number {
  const raw = input.paidAmount - input.cancellationCharge - input.gatewayCharge - input.fixedDeduction;
  return Math.max(0, raw);
}
