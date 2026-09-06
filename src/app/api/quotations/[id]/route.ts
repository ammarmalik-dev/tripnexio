import type { NextRequest } from "next/server";
import { updateQuotationSchema } from "@/lib/validation/quotation-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { getStaffSession } from "@/lib/auth/staff-session";
import { computeSellingPrice, assertValidityWithinCap } from "@/lib/quotations/pricing";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

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

  if (parsed.data.vendorId) {
    const vendor = await db.vendor.findUnique({ where: { id: parsed.data.vendorId } });
    if (!vendor || !vendor.active) {
      return jsonError(400, "Select a valid, active vendor.", { vendorId: ["This vendor isn't available."] });
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
  });
  const margin = sellingPrice - vendorCost;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.quotation.update({
      where: { id },
      data: {
        ...parsed.data,
        vendorCost,
        sellingPrice,
        margin,
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
      note: `Updated by ${session.name} — margin now ${margin}`,
    });

    return result;
  });

  return jsonSuccess(updated);
}
