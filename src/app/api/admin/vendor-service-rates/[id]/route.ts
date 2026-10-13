import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { serializeVendorServiceRate, updateVendorServiceRateSchema, VENDOR_RATE_INCLUDE } from "@/lib/vendors/service-rates";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Client doc 2026-10-14 — change a vendor rate's cost or switch it on/off (reason required, audited). */
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
  const parsed = updateVendorServiceRateSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  const existing = await db.vendorServiceRate.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Vendor rate not found.");

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.vendorServiceRate.update({ where: { id }, data: parsed.data, include: VENDOR_RATE_INCLUDE });
    await writeAudit(tx, {
      entityType: "VendorServiceRate",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: withReason(
        `Vendor rate ${row.vendor.name} · ${row.serviceType} · ${row.country.name}: ₹${existing.cost.toString()} → ₹${row.cost.toString()}${row.active === existing.active ? "" : row.active ? " (enabled)" : " (disabled)"} (by ${session.name})`,
        reason
      ),
    });
    return row;
  });
  return jsonSuccess(serializeVendorServiceRate(updated));
}
