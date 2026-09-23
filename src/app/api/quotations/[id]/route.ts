import type { NextRequest } from "next/server";
import { updateQuotationSchema } from "@/lib/validation/quotation-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { computeSellingPrice, assertValidityWithinCap } from "@/lib/quotations/pricing";
import { resolveCouponForQuotation } from "@/lib/coupons/apply";
import { findActiveAirlineByCode } from "@/lib/airlines/find-active-airline";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

  const lead = await db.lead.findUnique({ where: { id: existing.leadId } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;

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

  const validityError = assertValidityWithinCap(lead.serviceType, parsed.data.validityExpiresAt);
  if (validityError) {
    return jsonError(400, validityError, { validityExpiresAt: [validityError] });
  }

  // Selling price and margin are always recomputed server-side from the effective inputs — never trust a client-sent value.
  const vendorCost = parsed.data.vendorCost ?? Number(existing.vendorCost);
  const sellingPrice = computeSellingPrice(lead.serviceType, {
    sellingPrice: parsed.data.sellingPrice ?? (existing.sellingPrice ? Number(existing.sellingPrice) : undefined),
    feeAmount: parsed.data.feeAmount ?? (existing.feeAmount ? Number(existing.feeAmount) : undefined),
    fineOrCharges: parsed.data.fineOrCharges ?? (existing.fineOrCharges ? Number(existing.fineOrCharges) : undefined),
    flightTicketPrice:
      parsed.data.flightTicketPrice ?? (existing.flightTicketPrice ? Number(existing.flightTicketPrice) : undefined),
  });
  const margin = sellingPrice - vendorCost;

  // Step 22 (audit §3.2/§4.2/§7.8) — pulled out of the raw spread below and
  // re-resolved server-side rather than trusting `couponCode` as a plain
  // passthrough string. `couponCode` absent from the body = leave the
  // existing coupon (if any) untouched; an explicit empty string clears it.
  const { couponCode, ...restOfPatch } = parsed.data;
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
      },
    });

    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Updated by ${session.name} — margin now ${margin}${couponFields ? (couponFields.couponCode ? `, coupon ${couponFields.couponCode} applied (-₹${couponFields.couponDiscount})` : ", coupon removed") : ""}`,
    });

    return result;
  });

  return jsonSuccess(updated);
}
