import { db } from "../db";
import { leadReference } from "../leads/reference";
import { getEffectiveTerms, resolveLeadCountryId } from "../terms/service-terms";
import { isExpiredNow } from "./sync-expiry";
import { isFlightQuote, supportsItinerary } from "./pricing";
import { getServiceTimelineRules } from "../settings/service-timeline-config";
import { DEFAULT_PAYMENT_LINK_VALIDITY_HOURS } from "../payments/create-payment";
import { EXTENSION_DURATION_DAYS, urgentDeadlineFromDetails } from "../visa-extension/rules";
import { customerBlockRows, OPERATIONAL_BLOCK_TITLE, parseOperationalBlock } from "../visa-change/operational";
import { alternativeRouteLabel, requestedRouteFromDetails } from "./flight-quote";
import { parseStoredItinerary, supportsMultiSectorItinerary } from "./itinerary";

const money = (value: unknown) => (value === null || value === undefined ? null : Number(value));

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
    // P22 — unsent drafts are never visible to the customer.
    include: { quotations: { where: { isDraft: false }, orderBy: { createdAt: "desc" } } },
  });
  if (!lead) return null;

  const booking = await db.booking.findFirst({
    where: { leadId: lead.id, status: { not: "CANCELLED" } },
    orderBy: { createdAt: "desc" },
    select: { customerToken: true },
  });

  const flight = isFlightQuote(lead.serviceType);
  const requestedRoute = flight ? requestedRouteFromDetails(lead.details) : null;
  const visible = lead.quotations.filter((quotation) => quotation.isSelected || !isExpiredNow(quotation));
  // P15 — a Special Fare customer whose every quote lapsed still sees the
  // most recent one, marked expired, with "Request New Quote".
  const shown = flight && visible.length === 0 && lead.quotations.length > 0 ? [lead.quotations[0]] : visible;

  // The requested-route options first; alternatives after them.
  const ordered = [...shown].sort((a, b) => Number(Boolean(a.alternativeOfId)) - Number(Boolean(b.alternativeOfId)));

  const quotations = ordered
    .map((quotation) => ({
      id: quotation.id,
      expired: !quotation.isSelected && isExpiredNow(quotation),
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
      // P22 — multi-sector itinerary (customer-safe: places, times, airline, flight number, sector notes).
      ...(supportsMultiSectorItinerary(lead.serviceType) ? { itinerary: parseStoredItinerary(quotation.itinerary) } : {}),
      // P15 — Special Fare: fares per passenger type, the customer-facing
      // details and cancellation terms (never vendor cost, margin or vendor
      // reference), and the alternative-route wording.
      ...(flight
        ? {
            adultFare: money(quotation.adultFare),
            childFare: money(quotation.childFare),
            infantFare: money(quotation.infantFare),
            terminal: quotation.terminal,
            reportingTime: quotation.reportingTime,
            fareRules: quotation.fareRules,
            restrictions: quotation.restrictions,
            bookingDeadline: quotation.bookingDeadline,
            cancellation: {
              allowed: quotation.cancellationAllowed,
              charge: money(quotation.cancellationCharge),
              chargeBasis: quotation.chargeBasis,
              timeCondition: quotation.timeCondition,
              noShowCharge: money(quotation.noShowCharge),
              estimatedRefund: money(quotation.estimatedRefund),
              policy: quotation.customerCancellationPolicy,
            },
            alternativeLabel: quotation.alternativeOfId ? alternativeRouteLabel(requestedRoute, quotation.route) : null,
          }
        : {}),
      // P14 — Visa Change: the option's A2A or Border block (customer-safe rows only — never vendor/cost).
      ...(lead.serviceType === "VISA_CHANGE"
        ? (() => {
            const block = parseOperationalBlock(quotation.operationalBlock);
            return block ? { operational: { title: OPERATIONAL_BLOCK_TITLE[block.kind], rows: customerBlockRows(block) } } : {};
          })()
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

  // P15 — Special Fare: passenger count by Adult / Child / Infant (from the lead's passengers).
  let passengerCounts: { adult: number; child: number; infant: number } | null = null;
  if (flight) {
    const ids = Array.isArray((lead.details as Record<string, unknown> | null)?.passengerIds)
      ? ((lead.details as Record<string, unknown>).passengerIds as string[])
      : [];
    const passengers = ids.length > 0 ? await db.passenger.findMany({ where: { id: { in: ids } }, select: { paxType: true } }) : [];
    passengerCounts = {
      adult: passengers.filter((p) => p.paxType === "ADULT").length,
      child: passengers.filter((p) => p.paxType === "CHILD").length,
      infant: passengers.filter((p) => p.paxType === "INFANT").length,
    };
  }
  const details = (lead.details ?? {}) as Record<string, unknown>;

  const terms = await getEffectiveTerms(lead.serviceType, await resolveLeadCountryId(lead.details));

  return {
    serviceType: lead.serviceType,
    leadReference: leadReference(lead),
    leadStatus: lead.status,
    quotations,
    bookingToken: booking?.customerToken ?? null,
    terms: terms ? { title: terms.title, body: terms.body, version: terms.version } : null,
    extension,
    specialFare: flight
      ? { requestedRoute, passengerCounts, newQuoteRequested: typeof details.newQuoteRequestedAt === "string" }
      : null,
  };
}
