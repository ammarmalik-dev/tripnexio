import type { NextRequest } from "next/server";
import { updateQuotationSchema } from "@/lib/validation/quotation-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  if (parsed.data.vendorId) {
    const vendor = await db.vendor.findUnique({ where: { id: parsed.data.vendorId } });
    if (!vendor || !vendor.active) {
      return jsonError(400, "Select a valid, active vendor.", { vendorId: ["This vendor isn't available."] });
    }
  }

  // Margin is always recomputed server-side from the effective cost/price — never trust a client-sent value.
  const vendorCost = parsed.data.vendorCost ?? Number(existing.vendorCost);
  const sellingPrice = parsed.data.sellingPrice ?? Number(existing.sellingPrice);
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
        validityExpiresAt: parsed.data.validityExpiresAt ? new Date(parsed.data.validityExpiresAt) : undefined,
      },
    });

    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: id,
      action: "UPDATE",
      note: `Updated — margin now ${margin}`,
    });

    return result;
  });

  return jsonSuccess(updated);
}
