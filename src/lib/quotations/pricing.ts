import type { ServiceType } from "../../generated/prisma/enums";

export const FLIGHT_QUOTE_MAX_VALIDITY_MINUTES = 30;

/** Only Flight Special Fare uses the structured fare/route form — every other service type gets the simple fee-based quote. */
export function isFlightQuote(serviceType: ServiceType): boolean {
  return serviceType === "FLIGHT_SPECIAL_FARE";
}

/**
 * Visa Change quotes can be built as itinerary options (client update: staff
 * offers 2-3 itineraries with different flight timings, customer picks one).
 * They keep the simple fee-based pricing and optionally add a flight-ticket
 * component and the itinerary's flight details.
 */
export function supportsItinerary(serviceType: ServiceType): boolean {
  return serviceType === "VISA_CHANGE";
}

interface PricingInput {
  sellingPrice?: number;
  feeAmount?: number;
  fineOrCharges?: number;
  flightTicketPrice?: number;
}

/**
 * Selling price (the customer-facing total) is staff-entered directly for
 * flight quotes, and computed as feeAmount + fineOrCharges (+ the flight
 * ticket price on a Visa Change itinerary) for every other service type — mirrors how margin is always computed, never trusted from
 * the client.
 */
export function computeSellingPrice(serviceType: ServiceType, input: PricingInput): number {
  if (isFlightQuote(serviceType)) {
    return input.sellingPrice ?? 0;
  }
  const flightTicket = supportsItinerary(serviceType) ? (input.flightTicketPrice ?? 0) : 0;
  return (input.feeAmount ?? 0) + (input.fineOrCharges ?? 0) + flightTicket;
}

export function assertValidityWithinCap(serviceType: ServiceType, validityExpiresAt: string | undefined): string | null {
  if (!isFlightQuote(serviceType) || !validityExpiresAt) return null;
  const maxExpiry = Date.now() + FLIGHT_QUOTE_MAX_VALIDITY_MINUTES * 60 * 1000;
  if (new Date(validityExpiresAt).getTime() > maxExpiry) {
    return `Flight quote validity can't exceed ${FLIGHT_QUOTE_MAX_VALIDITY_MINUTES} minutes.`;
  }
  return null;
}
