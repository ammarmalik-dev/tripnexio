import { db } from "../db";

/**
 * A true singleton row, fetched/updated by this fixed id. Replaces the
 * SAMPLE_GST_RATE/SAMPLE_GATEWAY_FEE_RATE constants that used to be
 * hard-coded directly in the payment-creation route.
 */
export const TAX_FEE_CONFIG_ID = "singleton";

// GST is OFF by default per the client's locked rule (ADMIN.md/CRM.md:
// "Current: GST OFF, invoice non-GST"). Only used if the seeded singleton
// row is somehow missing — should not happen in practice.
const FALLBACK_GST_RATE_PERCENT = 0;
const FALLBACK_GATEWAY_FEE_RATE_PERCENT = 2;

export interface TaxFeeRates {
  gstRate: number; // fraction, e.g. 0.05
  gatewayFeeRate: number; // fraction, e.g. 0.02
}

/** Reads the current tax/fee config as fractions ready to multiply into an amount — used by payment/invoice calculations. */
export async function getTaxFeeRates(): Promise<TaxFeeRates> {
  const config = await db.taxFeeConfig.findUnique({ where: { id: TAX_FEE_CONFIG_ID } });
  if (!config) {
    return { gstRate: FALLBACK_GST_RATE_PERCENT / 100, gatewayFeeRate: FALLBACK_GATEWAY_FEE_RATE_PERCENT / 100 };
  }
  return { gstRate: Number(config.gstRatePercent) / 100, gatewayFeeRate: Number(config.gatewayFeePercent) / 100 };
}
