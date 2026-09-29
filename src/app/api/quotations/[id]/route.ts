import type { NextRequest } from "next/server";
import { updateQuotationSchema } from "@/lib/validation/quotation-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { computeSellingPrice } from "@/lib/quotations/pricing";
import { assertValidityWithinCap } from "@/lib/quotations/validity-cap";
import { resolveCouponForQuotation } from "@/lib/coupons/apply";
import { findActiveAirlineByCode } from "@/lib/airlines/find-active-airline";
import { Prisma, type Quotation } from "@/generated/prisma/client";
import { isExpiredNow } from "@/lib/quotations/sync-expiry";
import { normalizeItinerary, supportsMultiSectorItinerary } from "@/lib/quotations/itinerary";
import { notifyQuoteReady } from "@/lib/quotations/send-quotation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Fields compared for the revision audit note (old → new). vendorCost/margin stay in the staff-only audit trail, never a customer view. */
const REVISION_TRACKED_FIELDS = [
  "vendorId",
  "airline",
  "flightNumber",
  "route",
  "flightDateTime",
  "arrivalDateTime",
  "baggageAllowance",
  "fareType",
  "adultFare",
  "childFare",
  "infantFare",
  "feeAmount",
  "fineOrCharges",
  "otherCharges",
  "flightTicketPrice",
  "vendorCost",
  "sellingPrice",
  "margin",
  "couponCode",
  "couponDiscount",
  "validityExpiresAt",
  "terminal",
  "reportingTime",
  "fareRules",
  "restrictions",
  "vendorReference",
  "bookingDeadline",
  "cancellationAllowed",
  "cancellationCharge",
  "chargeBasis",
  "timeCondition",
  "noShowCharge",
  "estimatedRefund",
  "customerCancellationPolicy",
  "alternativeOfId",
  "itinerary",
] as const satisfies readonly (keyof Quotation)[];

function auditValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Prisma.Decimal) return value.toString();
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function describeChanges(before: Quotation, after: Quotation): string[] {
  const changes: string[] = [];
  for (const field of REVISION_TRACKED_FIELDS) {
    const oldValue = auditValue(before[field]);
    const newValue = auditValue(after[field]);
    if (oldValue !== newValue) changes.push(`${field}: ${oldValue} -> ${newValue}`);
  }
  return changes;
}

/**
 * P22 item 7 — edit a quotation. Two modes, decided by the stored row:
 *
 * - DRAFT (isDraft=true): edited freely in place. No revision bump, no
 *   customer notification — the customer can't see a draft at all.
 * - SENT (isDraft=false): this is a "revision". Allowed only while the
 *   quotation is not selected, not expired, and the lead has no active
 *   booking (once a customer has picked/paid, the priced quote is frozen).
 *   The same row is edited in place, `revision` increments, every changed
 *   field is written to the AuditTrail as old -> new, and the customer is
 *   re-notified (QUOTE_READY) with the revised price. The CRM exposes this
 *   as an explicit "Send revision" action, so a sent quote can never be
 *   silently changed under the customer.
 *
 * A selected quotation is never editable (draft or not).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("quotations.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateQuotationSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.quotation.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Quotation not found.");

  const lead = await db.lead.findUnique({ where: { id: existing.leadId }, include: { customer: true } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;

  if (existing.isSelected) {
    return jsonError(409, "A selected quotation can't be edited.");
  }
  const isRevision = !existing.isDraft;
  if (isRevision) {
    if (isExpiredNow(existing)) {
      return jsonError(409, "This quotation has expired — revalidate it or build a new quote instead of revising it.");
    }
    const activeBooking = await db.booking.findFirst({
      where: { leadId: existing.leadId, status: { not: "CANCELLED" } },
      select: { id: true },
    });
    if (activeBooking) {
      return jsonError(409, "This lead already has a booking — its quotations can no longer be revised.");
    }
    if (parsed.data.validityExpiresAt && new Date(parsed.data.validityExpiresAt).getTime() <= Date.now()) {
      const message = "A revised quotation's validity must be in the future.";
      return jsonError(400, message, { validityExpiresAt: [message] });
    }
  }

  // P22 — multi-sector itinerary: Visa Change / Flight Special Fare only
  // (service type derived from the lead server-side). An empty array clears it.
  const { itinerary: itineraryInput, couponCode, ...restOfPatch } = parsed.data;
  const multiSector = supportsMultiSectorItinerary(lead.serviceType);
  if (itineraryInput && itineraryInput.length > 0 && !multiSector) {
    return jsonError(400, "An itinerary can only be added to Visa Change or Special Fare quotations.", {
      itinerary: ["Not available for this service."],
    });
  }
  const itineraryField: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined =
    itineraryInput === undefined || !multiSector
      ? undefined
      : itineraryInput.length === 0
        ? Prisma.DbNull
        : (normalizeItinerary(itineraryInput) as unknown as Prisma.InputJsonValue);

  if (parsed.data.alternativeOfId) {
    const alternativeOf = await db.quotation.findUnique({ where: { id: parsed.data.alternativeOfId } });
    if (!alternativeOf || alternativeOf.leadId !== existing.leadId || alternativeOf.id === id) {
      return jsonError(400, "The alternative quotation must be another quotation on the same lead.", {
        alternativeOfId: ["Invalid alternative quotation."],
      });
    }
  }

  if (parsed.data.vendorId) {
    const vendor = await db.vendor.findUnique({ where: { id: parsed.data.vendorId } });
    if (!vendor || !vendor.active) {
      return jsonError(400, "Select a valid, active vendor.", { vendorId: ["This vendor isn't available."] });
    }
  }

  if (parsed.data.airline) {
    const airlineRecord = await findActiveAirlineByCode(parsed.data.airline);
    if (!airlineRecord) {
      return jsonError(400, "Select a valid, active airline.", { airline: ["This airline isn't available."] });
    }
  }

  const validityError = await assertValidityWithinCap(lead.serviceType, parsed.data.validityExpiresAt);
  if (validityError) {
    return jsonError(400, validityError, { validityExpiresAt: [validityError] });
  }

  // Selling price and margin are always recomputed server-side from the effective inputs — never trust a client-sent value.
  const vendorCost = parsed.data.vendorCost ?? Number(existing.vendorCost);
  const sellingPrice = computeSellingPrice(lead.serviceType, {
    sellingPrice: parsed.data.sellingPrice ?? (existing.sellingPrice ? Number(existing.sellingPrice) : undefined),
    feeAmount: parsed.data.feeAmount ?? (existing.feeAmount ? Number(existing.feeAmount) : undefined),
    fineOrCharges: parsed.data.fineOrCharges ?? (existing.fineOrCharges ? Number(existing.fineOrCharges) : undefined),
    otherCharges: parsed.data.otherCharges ?? (existing.otherCharges ? Number(existing.otherCharges) : undefined),
    flightTicketPrice:
      parsed.data.flightTicketPrice ?? (existing.flightTicketPrice ? Number(existing.flightTicketPrice) : undefined),
  });
  const margin = sellingPrice - vendorCost;

  // Step 22 (audit §3.2/§4.2/§7.8) — pulled out of the raw spread below and
  // re-resolved server-side rather than trusting `couponCode` as a plain
  // passthrough string. `couponCode` absent from the body = leave the
  // existing coupon (if any) untouched; an explicit empty string clears it.
  let couponFields: { couponId: string | null; couponCode: string | null; couponDiscount: number | null } | undefined;
  if (couponCode !== undefined) {
    if (couponCode === "") {
      couponFields = { couponId: null, couponCode: null, couponDiscount: null };
    } else {
      const result = await resolveCouponForQuotation(couponCode, lead.serviceType, sellingPrice);
      if (!result.ok) {
        return jsonError(400, result.error, { couponCode: [result.error] });
      }
      couponFields = { couponId: result.coupon.couponId, couponCode: result.coupon.couponCode, couponDiscount: result.coupon.discountAmount };
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.quotation.update({
      where: { id },
      data: {
        ...restOfPatch,
        vendorCost,
        sellingPrice,
        margin,
        ...couponFields,
        flightDateTime: parsed.data.flightDateTime ? new Date(parsed.data.flightDateTime) : undefined,
        arrivalDateTime: parsed.data.arrivalDateTime ? new Date(parsed.data.arrivalDateTime) : undefined,
        validityExpiresAt: parsed.data.validityExpiresAt ? new Date(parsed.data.validityExpiresAt) : undefined,
        bookingDeadline: parsed.data.bookingDeadline ? new Date(parsed.data.bookingDeadline) : undefined,
        itinerary: itineraryField,
        ...(isRevision ? { revision: { increment: 1 } } : {}),
      },
    });

    const changes = describeChanges(existing, result);
    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: id,
      action: isRevision ? "REVISE" : "UPDATE",
      byUserId: session.id,
      note: `${isRevision ? `Revision ${result.revision} sent` : "Draft updated"} by ${session.name} — margin now ${margin}${couponFields ? (couponFields.couponCode ? `, coupon ${couponFields.couponCode} applied (-₹${couponFields.couponDiscount})` : ", coupon removed") : ""}. Changes: ${changes.length > 0 ? changes.join("; ") : "none"}`,
    });

    return result;
  });

  // A sent quotation's revision is visible to the customer immediately, so
  // they're re-notified with the revised price (never for a draft edit).
  if (isRevision) {
    await notifyQuoteReady(lead, updated);
  }

  return jsonSuccess(updated);
}
