import { db } from "../db";
import { specialFarePaxCounts } from "../special-fare/pax-counts";
import { leadUploadPassengers } from "./lead-document-upload";
import { leadReference } from "../leads/reference";
import { getEffectiveTerms, leadFlightScope, resolveLeadCountryId } from "../terms/service-terms";
import { isExpiredNow } from "./sync-expiry";
import { isFlightQuote, supportsItinerary } from "./pricing";
import { resolvePaymentLinkValidityHours } from "../payments/create-payment";
import { customerPaxLines, usesPaxCosting } from "./pax-costing";
import { EXTENSION_DURATION_DAYS, urgentDeadlineFromDetails } from "../visa-extension/rules";
import { customerBlockRows, OPERATIONAL_BLOCK_TITLE, parseOperationalBlock } from "../visa-change/operational";
import { alternativeRouteLabel, requestedRouteFromDetails } from "./flight-quote";
import { loadAirlineDisplay } from "../airlines/display";
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

  // Client corrections 2026-10-05 §9 — airline name + logo for every flight shown (quote + itinerary sectors).
  const airlineDisplay = await loadAirlineDisplay(
    ordered.flatMap((quotation) => [quotation.airline, ...parseStoredItinerary(quotation.itinerary).map((segment) => segment.airline)])
  );

  // Client doc 2026-10-14 — each option shows the departure / arrival city, not only airport codes.
  const placeCodes = [
    ...new Set(
      ordered.flatMap((quotation) => [
        quotation.fromAirportCode,
        quotation.toAirportCode,
        ...parseStoredItinerary(quotation.itinerary).flatMap((segment) => [segment.from, segment.to]),
      ])
    ),
  ].filter((code): code is string => Boolean(code));
  const airports = placeCodes.length
    ? await db.airport.findMany({ where: { code: { in: placeCodes.map((code) => code.toUpperCase()) } }, select: { code: true, city: true } })
    : [];
  const cityOf = new Map(airports.map((airport) => [airport.code, airport.city]));
  const place = (code: string) => {
    const city = cityOf.get(code.trim().toUpperCase());
    return city ? `${city} (${code.trim().toUpperCase()})` : code;
  };
  const cityRoute = (quotation: (typeof ordered)[number]) =>
    quotation.fromAirportCode && quotation.toAirportCode ? `${place(quotation.fromAirportCode)} → ${place(quotation.toAirportCode)}` : quotation.route;

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
            airline: quotation.airline ? (airlineDisplay[quotation.airline.toUpperCase()]?.name ?? quotation.airline) : null,
            airlineLogoUrl: quotation.airline ? (airlineDisplay[quotation.airline.toUpperCase()]?.logoUrl ?? null) : null,
            airlines: airlineDisplay,
            flightScope: quotation.flightScope,
            flightNumber: quotation.flightNumber,
            route: cityRoute(quotation),
            flightDateTime: quotation.flightDateTime,
            arrivalDateTime: quotation.arrivalDateTime,
            baggageAllowance: quotation.baggageAllowance,
            fareType: quotation.fareType,
          }
        : {}),
      // P22 — multi-sector itinerary (customer-safe: places, times, airline, flight number, sector notes).
      ...(supportsMultiSectorItinerary(lead.serviceType)
        ? { itinerary: parseStoredItinerary(quotation.itinerary).map((segment) => ({ ...segment, from: place(segment.from), to: place(segment.to) })) }
        : {}),
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
            alternativeLabel: quotation.alternativeOfId ? alternativeRouteLabel(requestedRoute, cityRoute(quotation)) : null,
          }
        : {}),
      // P14 — Visa Change: the option's A2A or Border block (customer-safe rows only — never vendor/cost).
      ...(lead.serviceType === "VISA_CHANGE"
        ? (() => {
            const block = parseOperationalBlock(quotation.operationalBlock);
            return {
              ...(block ? { operational: { title: OPERATIONAL_BLOCK_TITLE[block.kind], rows: customerBlockRows(block) } } : {}),
              // Client corrections 2026-10-05 — package inclusions / exclusions on the quote.
              inclusions: quotation.inclusions,
              exclusions: quotation.exclusions,
            };
          })()
        : {}),
      // Client doc 2026-10-15 — Visa Extension / Visa Change: the passengers this quote covers, each with
      // their fine and amount (never the vendor cost); a passenger not listed isn't on this quote.
      ...(usesPaxCosting(lead.serviceType) ? { passengerLines: customerPaxLines(quotation.paxCosting) } : {}),
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
          paymentDeadlineHours: await resolvePaymentLinkValidityHours("VISA_EXTENSION", lead.countryId),
          urgentDeadline: urgentDeadlineFromDetails(lead.details),
        }
      : null;

  // P15 — Special Fare: passenger count by Adult / Child / Infant (from the lead's passengers).
  let passengerCounts: { adult: number; child: number; infant: number } | null = null;
  if (flight) passengerCounts = await specialFarePaxCounts(lead);
  const details = (lead.details ?? {}) as Record<string, unknown>;

  const terms = await getEffectiveTerms(lead.serviceType, await resolveLeadCountryId(lead.details), await leadFlightScope(lead));

  return {
    serviceType: lead.serviceType,
    leadReference: leadReference(lead),
    leadStatus: lead.status,
    quotations,
    bookingToken: booking?.customerToken ?? null,
    terms: terms ? { title: terms.title, body: terms.body, version: terms.version, acceptanceText: terms.acceptanceText } : null,
    extension,
    // Client doc 2026-10-15 — Visa Extension / Visa Change: per-passenger uploads before the quotation (until booked).
    uploadPassengers: booking ? [] : await leadUploadPassengers(lead),
    specialFare: flight
      ? { requestedRoute, passengerCounts, newQuoteRequested: typeof details.newQuoteRequestedAt === "string" }
      : null,
  };
}
