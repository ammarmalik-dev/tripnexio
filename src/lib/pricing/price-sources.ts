import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Which services actually read `PricingRule`. New Visa prices its checkout
 * from it (src/lib/new-visa/pricing.ts) and Visa Change suggests its quote fee
 * from it (src/lib/quotations/visa-change-pricing.ts). Every other service
 * takes its price from somewhere else, so a pricing rule for it would never be
 * used (client reply 2026-10-13: a Bahrain Return Ticket rule of ₹1 changed
 * nothing because the website reads the Return Ticket destination rate).
 */
export const PRICING_RULE_SERVICES: readonly ServiceType[] = ["NEW_VISA", "VISA_CHANGE"];

export function usesPricingRules(serviceType: ServiceType): boolean {
  return PRICING_RULE_SERVICES.includes(serviceType);
}

/** Where a service's price is really set — shown wherever an unused pricing rule appears. */
export const PRICE_SOURCE_NOTES: Record<ServiceType, string> = {
  NEW_VISA: "Pricing rules (country, product, processing, passenger type).",
  VISA_CHANGE: "Pricing rules suggest the fee; the quotation sets the final price.",
  OTB: "Pricing Dashboard → OTB (country × airline).",
  RETURN_TICKET: "Pricing Dashboard → Return Ticket (country).",
  VISA_EXTENSION: "The quotation staff build for each request.",
  FLIGHT_SPECIAL_FARE: "The quotation staff build for each request.",
  OTHER: "The quotation staff build for each request.",
};

export function unusedRuleMessage(serviceType: ServiceType): string {
  return `Not used — this service's price is set in: ${PRICE_SOURCE_NOTES[serviceType]}`;
}
