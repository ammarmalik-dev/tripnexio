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

/**
 * Which service types' quotes capture an operating airline at all (§9,
 * Admin FINAL handover — wire the shared Airline master into every service
 * that deals with one, not just OTB). Flight Special Fare and Visa Change
 * already show an "Airline" field (flight quote / itinerary block); Return
 * Ticket gets a new, optional one here — it's fundamentally an airline
 * ticket reservation, but unlike the other two the client's own locked spec
 * never has the customer pick an airline, so this is staff-entered on the
 * quotation (once known), not a customer-facing form field.
 */
export function capturesAirline(serviceType: ServiceType): boolean {
  return isFlightQuote(serviceType) || supportsItinerary(serviceType) || serviceType === "RETURN_TICKET";
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

