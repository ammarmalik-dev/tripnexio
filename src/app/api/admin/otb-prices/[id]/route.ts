import type { NextRequest } from "next/server";
import { updateOtbPriceSchema } from "@/lib/validation/otb-price-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { serializeOtbPrice } from "@/lib/otb/pricing";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** P18 — edit an OTB price's amounts or enable/disable it. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = updateOtbPriceSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  const existing = await db.otbPrice.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "OTB price not found.");

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.otbPrice.update({
      where: { id },
      data: parsed.data,
      include: { airline: { select: { name: true, code: true } }, country: { select: { name: true, code: true } } },
    });
    await writeAudit(tx, {
      entityType: "OtbPrice",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: withReason(`OTB price ${row.airline.code} → ${row.country.name} (${row.paxType}) updated: normal ${Number(row.normalPrice)}, urgent ${row.urgentPrice === null ? "airline price" : Number(row.urgentPrice)}, ${row.active ? "active" : "disabled"} (by ${session.name})`, reason),
    });
    return row;
  });
  return jsonSuccess(serializeOtbPrice(updated));
}
