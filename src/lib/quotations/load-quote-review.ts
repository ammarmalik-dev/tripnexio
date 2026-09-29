import { db } from "../db";
import { leadReference } from "../leads/reference";
import { getEffectiveTerms, resolveLeadCountryId } from "../terms/service-terms";
import { isExpiredNow } from "./sync-expiry";
import { isFlightQuote, supportsItinerary } from "./pricing";
import { getServiceTimelineRules } from "../settings/service-timeline-config";
import { DEFAULT_PAYMENT_LINK_VALIDITY_HOURS } from "../payments/create-payment";
import { EXTENSION_DURATION_DAYS, urgentDeadlineFromDetails } from "../visa-extension/rules";

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
      // P13 — Visa Extension: the customer sees the fee / fine / other charges breakdown.
      ...(lead.serviceType === "VISA_EXTENSION"
        ? {
            breakdown: {
              extensionFee: Number(quotation.feeAmount ?? 0),
              fine: Number(quotation.fineOrCharges ?? 0),
              otherCharges: Number(quotation.otherCharges ?? 0),
            },
          }
        : {}),
    }));

  // P13 — Visa Extension quote-page facts: 30-day duration, the payment
  // deadline (payment link validity), where the new validity is counted
  // from, and — for a same-day (URGENT_TODAY) case — the 6:00 PM deadline
  // plus any UAE/India holiday on the next day.
  const extension =
    lead.serviceType === "VISA_EXTENSION"
      ? {
          durationDays: EXTENSION_DURATION_DAYS,
          paymentDeadlineHours: (await getServiceTimelineRules("VISA_EXTENSION")).paymentDeadlineHours ?? DEFAULT_PAYMENT_LINK_VALIDITY_HOURS,
          urgentDeadline: urgentDeadlineFromDetails(lead.details),
        }
      : null;

  const terms = await getEffectiveTerms(lead.serviceType, await resolveLeadCountryId(lead.details));

  return {
    serviceType: lead.serviceType,
    leadReference: leadReference(lead),
    leadStatus: lead.status,
    quotations,
    bookingToken: booking?.customerToken ?? null,
    terms: terms ? { title: terms.title, body: terms.body, version: terms.version } : null,
    extension,
  };
}
