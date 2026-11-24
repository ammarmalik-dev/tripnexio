import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { createVendorServiceRateSchema, serializeVendorServiceRate, updateVendorServiceRateSchema, VENDOR_RATE_INCLUDE } from "@/lib/vendors/service-rates";
import { prepareVendorRate } from "@/lib/vendors/prepare-rate";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Client doc 2026-10-14 — change a vendor rate's cost or switch it on/off; client doc 16 Nov (K9) — or any of its
 * columns (vendor, service, country, airline, visa type, nationality, passenger, processing). Reason required, audited.
 */
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

  const existing = await db.vendorServiceRate.findUnique({ where: { id }, include: VENDOR_RATE_INCLUDE });
  if (!existing) return jsonError(404, "Vendor rate not found.");

  // A full edit (every column) is checked like a new rate; a cost / on-off change keeps the rest as it is.
  let data: Record<string, unknown> = parsed.data;
  const full = createVendorServiceRateSchema.safeParse(body);
  if (full.success) {
    const prepared = await prepareVendorRate({ ...full.data, active: parsed.data.active ?? existing.active }, id);
    if (prepared.error) return prepared.error;
    data = prepared.data;
  }

  const updated = await db.$transaction(async (tx) => {
    const row = await tx.vendorServiceRate.update({ where: { id }, data, include: VENDOR_RATE_INCLUDE });
    await writeAudit(tx, {
      entityType: "VendorServiceRate",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: withReason(
        `Vendor rate ${existing.vendor.name} · ${existing.serviceType} · ${existing.country.name}${full.success ? ` → ${row.vendor.name} · ${row.serviceType} · ${row.country.name}${row.airline ? ` · ${row.airline.code}` : ""}${row.nationality ? ` · ${row.nationality.name}` : ""}${row.paxType ? ` · ${row.paxType}` : ""}${row.processingType ? ` · ${row.processingType}` : ""}` : ""}: ₹${existing.cost.toString()} → ₹${row.cost.toString()}${row.active === existing.active ? "" : row.active ? " (enabled)" : " (disabled)"} (by ${session.name})`,
        reason
      ),
    });
    return row;
  });
  return jsonSuccess(serializeVendorServiceRate(updated));
}
