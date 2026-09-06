import type { ServiceType } from "../../generated/prisma/enums";

export const FLIGHT_QUOTE_MAX_VALIDITY_MINUTES = 30;

/** Only Flight Special Fare uses the structured fare/route form — every other service type gets the simple fee-based quote. */
export function isFlightQuote(serviceType: ServiceType): boolean {
  return serviceType === "FLIGHT_SPECIAL_FARE";
}

interface PricingInput {
  sellingPrice?: number;
  feeAmount?: number;
  fineOrCharges?: number;
}

/**
 * Selling price (the customer-facing total) is staff-entered directly for
 * flight quotes, and computed as feeAmount + fineOrCharges for every other
 * service type — mirrors how margin is always computed, never trusted from
 * the client.
 */
export function computeSellingPrice(serviceType: ServiceType, input: PricingInput): number {
  if (isFlightQuote(serviceType)) {
    return input.sellingPrice ?? 0;
  }
  return (input.feeAmount ?? 0) + (input.fineOrCharges ?? 0);
}

export function assertValidityWithinCap(serviceType: ServiceType, validityExpiresAt: string | undefined): string | null {
  if (!isFlightQuote(serviceType) || !validityExpiresAt) return null;
  const maxExpiry = Date.now() + FLIGHT_QUOTE_MAX_VALIDITY_MINUTES * 60 * 1000;
  if (new Date(validityExpiresAt).getTime() > maxExpiry) {
    return `Flight quote validity can't exceed ${FLIGHT_QUOTE_MAX_VALIDITY_MINUTES} minutes.`;
  }
  return null;
}
