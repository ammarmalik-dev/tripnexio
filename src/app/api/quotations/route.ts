import type { NextRequest } from "next/server";
import { createQuotationSchema } from "@/lib/validation/quotation-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { syncExpiredQuotations } from "@/lib/quotations/sync-expiry";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");
  if (!leadId) {
    return jsonError(400, "Provide a leadId query parameter.");
  }

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return jsonError(404, "Lead not found.");

  const quotations = await db.quotation.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } });
  const refreshed = await syncExpiredQuotations(quotations);
  return jsonSuccess(refreshed);
}

export async function POST(request: NextRequest) {
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

  const { leadId, vendorId, airline, flightNumber, route, flightDateTime, vendorCost, sellingPrice, validityExpiresAt, alternativeOfId } =
    parsed.data;

  const lead = await db.lead.findUnique({ where: { id: leadId } });
  if (!lead) return jsonError(404, "Lead not found.");

  const vendor = await db.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor || !vendor.active) {
    return jsonError(400, "Select a valid, active vendor.", { vendorId: ["This vendor isn't available."] });
  }

  if (alternativeOfId) {
    const alternativeOf = await db.quotation.findUnique({ where: { id: alternativeOfId } });
    if (!alternativeOf || alternativeOf.leadId !== leadId) {
      return jsonError(400, "The alternative quotation must belong to the same lead.", {
        alternativeOfId: ["Invalid alternative quotation."],
      });
    }
  }

  // Margin is always computed server-side — never trust a client-sent value.
  const margin = sellingPrice - vendorCost;

  const quotation = await db.$transaction(async (tx) => {
    const created = await tx.quotation.create({
      data: {
        leadId,
        vendorId,
        airline,
        flightNumber,
        route,
        flightDateTime: flightDateTime ? new Date(flightDateTime) : undefined,
        vendorCost,
        sellingPrice,
        margin,
        validityExpiresAt: validityExpiresAt ? new Date(validityExpiresAt) : undefined,
        alternativeOfId,
      },
    });

    await writeAudit(tx, {
      entityType: "Quotation",
      entityId: created.id,
      action: "CREATE",
      note: `Quotation created for lead ${leadId} — margin ${margin}`,
    });

    return created;
  });

  return jsonSuccess(quotation, 201);
}
