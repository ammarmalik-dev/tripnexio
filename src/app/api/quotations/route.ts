import type { NextRequest } from "next/server";
import { createQuotationSchema } from "@/lib/validation/quotation-schema";
import { quotationListQuerySchema } from "@/lib/validation/quotation-query-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { syncExpiredQuotations } from "@/lib/quotations/sync-expiry";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess, serviceTypeCondition, isServiceScopeUnrestricted } from "@/lib/auth/service-scope";
import { computeSellingPrice, isFlightQuote, supportsItinerary } from "@/lib/quotations/pricing";
import { assertValidityWithinCap } from "@/lib/quotations/validity-cap";
import { resolveCouponForQuotation } from "@/lib/coupons/apply";
import { notifyCustomer } from "@/lib/notifications/notify";
import { NOTIFICATION_EVENTS } from "@/lib/notifications/events";
import { formatLeadReference } from "@/lib/leads/reference";
import { money } from "@/lib/invoices/render-invoice";
import { toWhatsAppId } from "@/lib/whatsapp/phone";
import { siteConfig } from "@/lib/site-config";
import { ensureLeadCustomerToken } from "@/lib/quotations/select-quotation";
import { findActiveAirlineByCode } from "@/lib/airlines/find-active-airline";
import type { Quotation } from "@/generated/prisma/client";

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
  const { serviceType, status, search, dateFrom, dateTo, sort, page, pageSize } = parsed.data;
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
    ...(serviceType || search || !isServiceScopeUnrestricted(auth.session)
      ? {
          lead: {
            ...serviceTypeCondition(auth.session, serviceType),
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
      include: { lead: { include: { customer: true } } },
      orderBy: { createdAt: sort === "createdAt_asc" ? "asc" : "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items = quotations.map((quotation) => ({
    id: quotation.id,
    leadId: quotation.leadId,
    leadReferenceId: formatLeadReference(quotation.lead.serviceType, quotation.leadId),
    serviceType: quotation.lead.serviceType,
    status: quotationStatus(quotation, now),
    sellingPrice: quotation.sellingPrice,
    // Internal-only — never sent to a customer-facing view (same rule
    // QuoteCard.tsx already follows). Included here because this whole
    // screen is staff-only (quotations.view-gated); the UI marks it
    // "(internal)" per the roadmap prompt's explicit ask.
    margin: quotation.margin,
    customer: { name: quotation.lead.customer.name, mobile: quotation.lead.customer.mobile },
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
    flightDateTime,
    arrivalDateTime,
    baggageAllowance,
    fareType,
    adultFare,
    childFare,
    infantFare,
    feeAmount,
    fineOrCharges,
    flightTicketPrice,
    vendorCost,
    sellingPrice,
    validityExpiresAt,
    alternativeOfId,
    couponCode,
  } = parsed.data;

  const lead = await db.lead.findUnique({ where: { id: leadId }, include: { customer: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;

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

  if (alternativeOfId) {
    const alternativeOf = await db.quotation.findUnique({ where: { id: alternativeOfId } });
    if (!alternativeOf || alternativeOf.leadId !== leadId) {
      return jsonError(400, "The alternative quotation must belong to the same lead.", {
        alternativeOfId: ["Invalid alternative quotation."],
      });
    }
  }

  // Selling price and margin are always computed/resolved server-side — never trust a client-sent value.
  const resolvedSellingPrice = computeSellingPrice(lead.serviceType, { sellingPrice, feeAmount, fineOrCharges, flightTicketPrice });
  const margin = resolvedSellingPrice - vendorCost;

  // Step 22 (audit §3.2/§4.2/§7.8) — resolved and validated here, not
  // trusted from the client; rejected outright for a flight quote (see
  // resolveCouponForQuotation's own doc comment on why).
  let appliedCoupon: { couponId: string; couponCode: string; discountAmount: number } | null = null;
  if (couponCode) {
    const result = await resolveCouponForQuotation(couponCode, lead.serviceType, resolvedSellingPrice);
    if (!result.ok) {
      return jsonError(400, result.error, { couponCode: [result.error] });
    }
    appliedCoupon = result.coupon;
  }

  const quotation = await db.$transaction(async (tx) => {
    const created = await tx.quotation.create({
      data: {
        leadId,
        vendorId,
        airline,
        flightNumber,
        route,
        flightDateTime: flightDateTime ? new Date(flightDateTime) : undefined,
        arrivalDateTime: arrivalDateTime ? new Date(arrivalDateTime) : undefined,
        baggageAllowance,
        fareType,
        adultFare,
        childFare,
        infantFare,
        feeAmount,
        fineOrCharges,
        flightTicketPrice: supportsItinerary(lead.serviceType) ? flightTicketPrice : undefined,
        vendorCost,
        sellingPrice: resolvedSellingPrice,
        margin,
        couponId: appliedCoupon?.couponId,
        couponCode: appliedCoupon?.couponCode,
        couponDiscount: appliedCoupon?.discountAmount,
        validityExpiresAt: validityExpiresAt ? new Date(validityExpiresAt) : undefined,
        alternativeOfId,
      },
    });

    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Quotation created for lead ${leadId} — margin ${margin}${appliedCoupon ? `, coupon ${appliedCoupon.couponCode} applied (-₹${appliedCoupon.discountAmount})` : ""} (by ${session.name})`,
    });

    // Step 49 — a fresh quotation moves an early-stage lead to QUOTATION_CREATED.
    // Only from the "not yet quoted" states — never regress a lead already
    // further along (accepted/payment-pending/converted), and never override
    // Follow-up Required/Lost/Closed, which are deliberately staff-controlled.
    const earlyStatuses = ["NEW", "CONTACTED", "FOLLOW_UP_REQUIRED", "CUSTOMER_RESPONDED", "QUALIFIED"];
    if (earlyStatuses.includes(lead.status)) {
      await tx.lead.update({ where: { id: leadId }, data: { status: "QUOTATION_CREATED" } });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: leadId,
        action: "STATUS_CHANGE",
        byUserId: session.id,
        note: `${lead.status} -> QUOTATION_CREATED (quotation created by ${session.name})`,
      });
    }

    return created;
  });

  const payableAfterCoupon = resolvedSellingPrice - (appliedCoupon?.discountAmount ?? 0);
  const reviewToken = await ensureLeadCustomerToken(lead);

  // "Quote ready" fires on every new quotation for this lead, not only the
  // first one — a lead can reasonably get more than one quote over its
  // lifetime (a revised offer, an alternative route), and there's no signal
  // in the data model for "this is the one to actually notify about" beyond
  // "a quote now exists." Revisit if the client wants this scoped tighter
  // (e.g. only on the first quote, or only once staff explicitly shares it).
  await notifyCustomer({
    event: NOTIFICATION_EVENTS.QUOTE_READY,
    emailTo: lead.customer.email,
    whatsappTo: toWhatsAppId(lead.customer.mobile),
    smsTo: toWhatsAppId(lead.customer.mobile),
    variables: {
      customerName: lead.customer.name,
      leadReference: formatLeadReference(lead.serviceType, lead.id),
      sellingPrice: money(payableAfterCoupon),
      quoteValidUntil: validityExpiresAt
        ? new Date(validityExpiresAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
        : "no expiry set",
      reviewLink: `${siteConfig.url}/quote/${reviewToken}`,
    },
    auditTarget: { entityType: "Quotation", entityId: quotation.id },
  });

  return jsonSuccess(quotation, 201);
}
