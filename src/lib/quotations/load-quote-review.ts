import { db } from "../db";
import { leadReference } from "../leads/reference";
import { getEffectiveTerms, resolveLeadCountryId } from "../terms/service-terms";
import { isExpiredNow } from "./sync-expiry";
import { isFlightQuote, supportsItinerary } from "./pricing";

/**
 * Loads a customer's quote-review page by their Lead's `customerToken`.
 * Deliberately omits internal-only fields (vendorCost, margin) — see
 * QuoteCard.tsx's own "(internal)" convention for the staff-facing
 * equivalent of this rule.
 */
export async function loadQuoteReviewByToken(token: string) {
  if (!/^[a-f0-9]{32}$/.test(token)) return null;

  const lead = await db.lead.findUnique({
    where: { customerToken: token },
    include: { quotations: { orderBy: { createdAt: "desc" } } },
  });
  if (!lead) return null;

  const booking = await db.booking.findFirst({
    where: { leadId: lead.id, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    select: { customerToken: true },
  });

  const quotations = lead.quotations
    .filter((quotation) => quotation.isSelected || !isExpiredNow(quotation))
    .map((quotation) => ({
      id: quotation.id,
      isSelected: quotation.isSelected,
      alternativeOfId: quotation.alternativeOfId,
      validityExpiresAt: quotation.validityExpiresAt,
      sellingPrice: Number(quotation.sellingPrice),
      couponCode: quotation.couponCode,
      couponDiscount: quotation.couponDiscount === null ? null : Number(quotation.couponDiscount),
      ...(isFlightQuote(lead.serviceType) || supportsItinerary(lead.serviceType)
        ? {
            airline: quotation.airline,
            flightNumber: quotation.flightNumber,
            route: quotation.route,
            flightDateTime: quotation.flightDateTime,
            arrivalDateTime: quotation.arrivalDateTime,
            baggageAllowance: quotation.baggageAllowance,
            fareType: quotation.fareType,
          }
        : {}),
    }));

  const terms = await getEffectiveTerms(lead.serviceType, await resolveLeadCountryId(lead.details));

  return {
    serviceType: lead.serviceType,
    leadReference: leadReference(lead),
    leadStatus: lead.status,
    quotations,
    bookingToken: booking?.customerToken ?? null,
    terms: terms ? { title: terms.title, body: terms.body, version: terms.version } : null,
  };
}
