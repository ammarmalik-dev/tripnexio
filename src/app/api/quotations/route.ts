import { leadOwnershipWhere, seesAllRecords } from "@/lib/auth/ownership";
import { resolveFlightRoute } from "@/lib/special-fare/flight-route";
import { defaultVisaChangeInclusions, VISA_CHANGE_EXCLUSIONS } from "@/lib/visa-change/inclusions";
import type { NextRequest } from "next/server";
import { createQuotationSchema } from "@/lib/validation/quotation-schema";
import { quotationListQuerySchema } from "@/lib/validation/quotation-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import type { Prisma } from "@/generated/prisma/client";
import { extensionQuoteBlockReason } from "@/lib/visa-extension/rules";
import { leadOperationalBlock, visaChangeQuoteBlockReason } from "@/lib/visa-change/operational";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { syncExpiredQuotations } from "@/lib/quotations/sync-expiry";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/permissions";
import { assertServiceAccess, serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { computeSellingPrice, isFlightQuote, supportsItinerary } from "@/lib/quotations/pricing";
import { assertValidityWithinCap } from "@/lib/quotations/validity-cap";
import { resolveCouponForQuotation } from "@/lib/coupons/apply";
import { leadReference } from "@/lib/leads/reference";
import { findActiveAirlineByCode } from "@/lib/airlines/find-active-airline";
import { dispatchStatusNotifications, type StatusNotification } from "@/lib/service-status/engine";
import { applyQuotationSentEffects, notifyQuoteReady } from "@/lib/quotations/send-quotation";
import { normalizeItinerary, supportsMultiSectorItinerary } from "@/lib/quotations/itinerary";
import type { Quotation } from "@/generated/prisma/client";
import { serviceDetailsLine } from "@/lib/crm/service-details";
import { countryFlagEmoji } from "@/lib/countries/flag";
import { subServiceLabel } from "@/lib/leads/sub-service-label";

/**
 * SELECTED/EXPIRED/PENDING is derived — Quotation only stores
 * isSelected/isExpired booleans. Computed live against `validityExpiresAt`
 * (not just the possibly-stale `isExpired` column) — matching
 * isExpiredNow() in src/lib/quotations/sync-expiry.ts — WITHOUT persisting
 * the flip or firing a QUOTE_EXPIRED notification. That write+notify side
 * effect belongs to the dedicated n8n automation job
 * (/api/automation/quote-expiry) or the small, lead-scoped sync already run
 * when opening one lead's own quotations — never a page-load of this
 * standalone list. See this route's own history: an earlier version called
 * syncExpiredQuotations() here on every past-due quotation across the
 * whole table, which in a long-lived dev DB meant one list-page load
 * synchronously sent hundreds of "quote expired" emails before it could
 * even respond — a real production risk if the automation job ever falls
 * behind, not just a dev-environment artifact.
 */
function quotationStatus(quotation: Pick<Quotation, "isSelected" | "isExpired" | "validityExpiresAt">, now: Date): "SELECTED" | "EXPIRED" | "PENDING" {
  if (quotation.isSelected) return "SELECTED";
  const liveExpired = quotation.isExpired || (quotation.validityExpiresAt !== null && quotation.validityExpiresAt < now);
  if (liveExpired) return "EXPIRED";
  return "PENDING";
}

export async function GET(request: NextRequest) {
  const auth = await requirePermission("quotations.view");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");

  // Existing lead-scoped mode (QuoteBuilder.tsx) — unchanged, still a plain array.
  if (leadId) {
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return jsonError(404, "Lead not found.");
    const scopeError = assertServiceAccess(auth.session, lead.serviceType);
    if (scopeError) return scopeError;

    const quotations = await db.quotation.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } });
    const refreshed = await syncExpiredQuotations(quotations);
    return jsonSuccess(refreshed);
  }

  // Standalone list mode (Step 13, audit §3.2) — paginated, filterable,
  // mirrors GET /api/leads and GET /api/bookings' shape.
  const parsed = quotationListQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const { serviceType, status, search, dateFrom, dateTo, assignedStaffId, countryId, travelFrom, travelTo, sort, page, pageSize } = parsed.data;
  const leadFilter: Prisma.LeadWhereInput = {
    ...(assignedStaffId ? { assignedStaffId: assignedStaffId === "unassigned" ? null : assignedStaffId } : {}),
    ...(countryId ? { countryId } : {}),
    ...(travelFrom || travelTo
      ? {
          travelDate: {
            ...(travelFrom ? { gte: new Date(`${travelFrom}T00:00:00Z`) } : {}),
            ...(travelTo ? { lte: new Date(`${travelTo}T00:00:00Z`) } : {}),
          },
        }
      : {}),
  };
  const hasLeadFilter = Object.keys(leadFilter).length > 0;
  // Vendor cost and margin are internal: only staff with vendors.viewCost or finance.manage see them (CLAUDE.md).
  const canViewMargin = hasPermission(auth.session, "vendors.viewCost") || hasPermission(auth.session, "finance.manage");
  const now = new Date();

  // "EXPIRED"/"PENDING" filter live against validityExpiresAt (not just the
  // stored isExpired column) — see quotationStatus()'s doc comment above
  // for why this route never writes isExpired or fires a notification
  // itself. A selected quotation is never "expired" for filtering purposes
  // even if its validity window has technically lapsed (selection already
  // forces isExpired=false and expires every sibling quote instead — see
  // PATCH /api/quotations/[id]/select).
  const liveExpiredCondition = { OR: [{ isExpired: true }, { validityExpiresAt: { lt: now } }] };

  // Built as one `lead` sub-filter (rather than spreading two separately
  // shaped `{ lead: ... }` objects into `where`) so a serviceType filter and
  // a search term combine correctly instead of one silently overwriting the
  // other's `lead` key.
  const where = {
    ...(status === "SELECTED" ? { isSelected: true } : {}),
    ...(status === "EXPIRED" ? { isSelected: false, ...liveExpiredCondition } : {}),
    ...(status === "PENDING"
      ? { isSelected: false, isExpired: false, OR: [{ validityExpiresAt: null }, { validityExpiresAt: { gte: now } }] }
      : {}),
    ...(dateFrom || dateTo
      ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } }
      : {}),
    ...(serviceType || search || hasLeadFilter || !isServiceScopeUnrestricted(auth.session) || !seesAllRecords(auth.session)
      ? {
          lead: {
            // Client testing 2026-10-09 (E7) — staff see quotations of their own + unassigned leads.
            ...leadOwnershipWhere(auth.session),
            ...serviceTypeCondition(auth.session, serviceType),
            ...leadFilter,
            ...(search
              ? {
                  customer: {
                    OR: [
                      { name: { contains: search, mode: "insensitive" as const } },
                      { mobile: { contains: search, mode: "insensitive" as const } },
                    ],
                  },
                }
              : {}),
          },
        }
      : {}),
  };

  const [total, quotations] = await Promise.all([
    db.quotation.count({ where }),
    db.quotation.findMany({
      where,
      include: {
        lead: {
          include: {
            customer: true,
            country: { select: { name: true, code: true, flagOverride: true } },
            assignedStaff: { select: { name: true, active: true } },
          },
        },
      },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = quotations.map((quotation) => ({
    id: quotation.id,
    leadId: quotation.leadId,
    leadReferenceId: leadReference(quotation.lead),
    serviceType: quotation.lead.serviceType,
    status: quotationStatus(quotation, now),
    sellingPrice: quotation.sellingPrice,
    // Internal-only — omitted (not just hidden) unless the viewer may see costs.
    margin: canViewMargin ? quotation.margin : null,
    customer: { name: quotation.lead.customer.name, mobile: quotation.lead.customer.mobile, email: quotation.lead.customer.email },
    countryName: quotation.lead.country?.name ?? null,
    // Client testing 2026-10-09 (E13) — the shared list layout: PAX, flag, sub-service, service details.
    countryFlag: quotation.lead.country ? countryFlagEmoji(quotation.lead.country) : null,
    paxCount: quotation.lead.paxCount,
    subService: subServiceLabel(quotation.lead.details),
    serviceDetails: serviceDetailsLine(quotation.lead.serviceType, quotation.lead.details),
    travelDate: quotation.lead.travelDate ? quotation.lead.travelDate.toISOString().slice(0, 10) : null,
    poc: quotation.lead.assignedStaff ? { name: quotation.lead.assignedStaff.name, active: quotation.lead.assignedStaff.active } : null,
    createdAt: quotation.createdAt,
  }));

  return jsonSuccess({ items, total, page, pageSize });
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("quotations.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createQuotationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const {
    leadId,
    vendorId,
    airline,
    flightNumber,
    route,
    fromAirportCode,
    toAirportCode,
    flightDateTime,
    arrivalDateTime,
    baggageAllowance,
    fareType,
    adultFare,
    childFare,
    infantFare,
    feeAmount,
    fineOrCharges,
    otherCharges,
    governmentFee,
    inclusions,
    exclusions,
    flightTicketPrice,
    vendorCost,
    sellingPrice,
    validityExpiresAt,
    terminal,
    reportingTime,
    fareRules,
    restrictions,
    vendorReference,
    bookingDeadline,
    cancellationAllowed,
    cancellationCharge,
    chargeBasis,
    timeCondition,
    noShowCharge,
    estimatedRefund,
    customerCancellationPolicy,
    alternativeOfId,
    couponCode,
    itinerary,
    saveAsDraft,
  } = parsed.data;
  const isDraft = saveAsDraft === true;

  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;
  // Client testing 2026-10-09 (A2) — New Visa / OTB / Return Ticket are never quoted: direct payment link from the lead.
  if (lead.serviceType === "NEW_VISA" || lead.serviceType === "OTB" || lead.serviceType === "RETURN_TICKET") {
    return jsonError(409, "This service is paid by a direct payment link from the lead — no quotation.");
  }
  // P13 — a Visa Extension is quoted only after staff verified it ELIGIBLE or URGENT_TODAY.
  const extensionBlock = extensionQuoteBlockReason(lead.serviceType, lead.details);
  if (extensionBlock) return jsonError(409, extensionBlock);
  // P14 — a Visa Change is quoted only once its A2A / Border operational
  // details are complete; each option carries a snapshot of them.
  const visaChangeBlock = visaChangeQuoteBlockReason(lead.serviceType, lead.details);
  if (visaChangeBlock) return jsonError(409, visaChangeBlock);
  const operationalBlock = lead.serviceType === "VISA_CHANGE" ? leadOperationalBlock(lead.details) : null;

  const vendor = await db.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor || !vendor.active) {
    return jsonError(400, "Select a valid, active vendor.", { vendorId: ["This vendor isn't available."] });
  }

  // §9 (Admin FINAL handover) — the shared Airline master, re-validated
  // server-side exactly like OTB's own lead-intake route does with its
  // airline code (never trust the client's string blindly).
  if (airline) {
    const airlineRecord = await findActiveAirlineByCode(airline);
    if (!airlineRecord) {
      return jsonError(400, "Select a valid, active airline.", { airline: ["This airline isn't available."] });
    }
  }

  const flightQuote = isFlightQuote(lead.serviceType);
  // Client corrections 2026-10-05 §9 — Special Fare airports come from the Airport master (a draft may leave them empty).
  let flightRoute: { route: string; flightScope: "DOMESTIC" | "INTERNATIONAL"; fromAirportCode: string; toAirportCode: string } | null = null;
  if (lead.serviceType === "FLIGHT_SPECIAL_FARE") {
    if (fromAirportCode && toAirportCode) {
      const resolved = await resolveFlightRoute(fromAirportCode, toAirportCode);
      if (!resolved.ok) return jsonError(400, resolved.error, { [resolved.field]: [resolved.error] });
      flightRoute = resolved;
    } else if (!isDraft) {
      return jsonError(400, "Select the departure and arrival airports.", {
        ...(fromAirportCode ? {} : { fromAirportCode: ["Select the departure airport."] }),
        ...(toAirportCode ? {} : { toAirportCode: ["Select the arrival airport."] }),
      });
    }
  }
  if (flightQuote && sellingPrice == null) {
    return jsonError(400, "Please check the highlighted fields.", { sellingPrice: ["Enter the selling price."] });
  }
  if (!flightQuote && feeAmount == null) {
    return jsonError(400, "Please check the highlighted fields.", { feeAmount: ["Enter the fee amount."] });
  }

  const validityError = await assertValidityWithinCap(lead.serviceType, validityExpiresAt);
  if (validityError) {
    return jsonError(400, validityError, { validityExpiresAt: [validityError] });
  }

  // P22 — multi-sector itinerary: Visa Change / Flight Special Fare only
  // (service type derived from the lead server-side, never the client).
  const multiSector = supportsMultiSectorItinerary(lead.serviceType);
  if (itinerary && itinerary.length > 0 && !multiSector) {
    return jsonError(400, "An itinerary can only be added to Visa Change or Special Fare quotations.", {
      itinerary: ["Not available for this service."],
    });
  }
  const storedItinerary = multiSector && itinerary && itinerary.length > 0 ? normalizeItinerary(itinerary) : null;

  if (alternativeOfId) {
    const alternativeOf = await db.quotation.findUnique({ where: { id: alternativeOfId } });
    if (!alternativeOf || alternativeOf.leadId !== leadId) {
      return jsonError(400, "The alternative quotation must belong to the same lead.", {
        alternativeOfId: ["Invalid alternative quotation."],
      });
    }
  }

  // Selling price and margin are always computed/resolved server-side — never trust a client-sent value.
  const resolvedSellingPrice = computeSellingPrice(lead.serviceType, { sellingPrice, feeAmount, fineOrCharges, otherCharges, flightTicketPrice });
  const margin = resolvedSellingPrice - vendorCost;
  if (governmentFee !== undefined && governmentFee > resolvedSellingPrice) {
    return jsonError(400, "The government / airline fee can't be more than the total price.", { governmentFee: ["Can't exceed the total price."] });
  }

  // Step 22 (audit §3.2/§4.2/§7.8) — resolved and validated here, not
  // trusted from the client; rejected outright for a flight quote (see
  // resolveCouponForQuotation's own doc comment on why).
  let appliedCoupon: { couponId: string; couponCode: string; discountAmount: number } | null = null;
  if (couponCode) {
    const result = await resolveCouponForQuotation(couponCode, lead.serviceType, resolvedSellingPrice, leadId);
    if (!result.ok) {
      return jsonError(400, result.error, { couponCode: [result.error] });
    }
    appliedCoupon = result.coupon;
  }

  const statusNotifications: (StatusNotification | null)[] = [];
  const quotation = await db.$transaction(async (tx) => {
    const created = await tx.quotation.create({
      data: {
        leadId,
        vendorId,
        airline,
        flightNumber,
        route: flightRoute?.route ?? route,
        fromAirportCode: flightRoute?.fromAirportCode,
        toAirportCode: flightRoute?.toAirportCode,
        flightScope: flightRoute?.flightScope,
        flightDateTime: flightDateTime ? new Date(flightDateTime) : undefined,
        arrivalDateTime: arrivalDateTime ? new Date(arrivalDateTime) : undefined,
        baggageAllowance,
        fareType,
        adultFare,
        childFare,
        infantFare,
        feeAmount,
        fineOrCharges,
        otherCharges,
        governmentFee,
        // Visa Change: the package's inclusions / exclusions (defaults from the method when staff left them empty).
        ...(lead.serviceType === "VISA_CHANGE"
          ? {
              inclusions: inclusions && inclusions.length > 0 ? inclusions : defaultVisaChangeInclusions((lead.details as Record<string, unknown> | null)?.changeType),
              exclusions: exclusions && exclusions.length > 0 ? exclusions : [...VISA_CHANGE_EXCLUSIONS],
            }
          : {}),
        operationalBlock: operationalBlock ? (operationalBlock as unknown as Prisma.InputJsonValue) : undefined,
        // P15 — flight quote details / cancellation terms (flight quotes only).
        ...(flightQuote
          ? {
              terminal,
              reportingTime,
              fareRules,
              restrictions,
              vendorReference,
              bookingDeadline: bookingDeadline ? new Date(bookingDeadline) : undefined,
              cancellationAllowed,
              cancellationCharge,
              chargeBasis,
              timeCondition,
              noShowCharge,
              estimatedRefund,
              customerCancellationPolicy,
            }
          : {}),
        flightTicketPrice: supportsItinerary(lead.serviceType) ? flightTicketPrice : undefined,
        vendorCost,
        sellingPrice: resolvedSellingPrice,
        margin,
        couponId: appliedCoupon?.couponId,
        couponCode: appliedCoupon?.couponCode,
        couponDiscount: appliedCoupon?.discountAmount,
        validityExpiresAt: validityExpiresAt ? new Date(validityExpiresAt) : undefined,
        alternativeOfId,
        itinerary: storedItinerary ? (storedItinerary as unknown as Prisma.InputJsonValue) : undefined,
        // P22 — a draft is invisible to the customer until POST /api/quotations/[id]/send.
        isDraft,
        sentAt: isDraft ? null : new Date(),
      },
    });

    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `${isDraft ? "Draft quotation" : "Quotation"} created${isDraft ? "" : " and sent"} for lead ${leadId} — margin ${margin}${appliedCoupon ? `, coupon ${appliedCoupon.couponCode} applied (-₹${appliedCoupon.discountAmount})` : ""} (by ${session.name})`,
    });

    // P22 — the "quotation sent" side effects (Step 49 lead-status move,
    // status-engine QUOTATION_CREATED event, P15 new-quote-request
    // resolution) only run for a quotation the customer can actually see.
    // A draft runs them later, from POST /api/quotations/[id]/send.
    if (!isDraft) {
      statusNotifications.push(await applyQuotationSentEffects(tx, lead, { byUserId: session.id, name: session.name }));
    }

    return created;
  });

  await dispatchStatusNotifications(statusNotifications);

  // "Quote ready" fires on every quotation the customer is sent — never for
  // a draft (P22). A lead can reasonably get more than one quote over its
  // lifetime (a revised offer, an alternative route).
  if (!isDraft) {
    await notifyQuoteReady(lead, quotation);
  }

  return jsonSuccess(quotation, 201);
}
