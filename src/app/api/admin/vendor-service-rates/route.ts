import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { createVendorServiceRateSchema, serializeVendorServiceRate, VENDOR_RATE_INCLUDE } from "@/lib/vendors/service-rates";
import { prepareVendorRate } from "@/lib/vendors/prepare-rate";

/**
 * Client doc 2026-10-14 — vendor rates for OTB / Return Ticket by vendor,
 * country, airline and processing type; New Visa (2026-10-15) by country,
 * nationality, Adult / Child and processing type. Internal cost data: Admin only
 * (masters.manage), never leaves /api/admin.
 */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const rows = await db.vendorServiceRate.findMany({
    include: VENDOR_RATE_INCLUDE,
    orderBy: [{ serviceType: "asc" }, { country: { name: "asc" } }, { vendor: { name: "asc" } }],
  });
  return jsonSuccess(rows.map(serializeVendorServiceRate));
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = createVendorServiceRateSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  const prepared = await prepareVendorRate(parsed.data);
  if (prepared.error) return prepared.error;
  const { data } = prepared;

  const created = await db.$transaction(async (tx) => {
    const row = await tx.vendorServiceRate.create({ data, include: VENDOR_RATE_INCLUDE });
    await writeAudit(tx, {
      entityType: "VendorServiceRate",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: withReason(
        `Vendor rate ${row.vendor.name} · ${row.serviceType} · ${row.country.name}${row.airline ? ` · ${row.airline.code}` : ""}${row.nationality ? ` · ${row.nationality.name}` : ""}${row.paxType ? ` · ${row.paxType}` : ""}${row.newVisaConfig ? ` · ${row.newVisaConfig.visaCategory}${row.newVisaConfig.stayDays ? ` ${row.newVisaConfig.stayDays}d` : ""}` : ""}${row.processingType ? ` · ${row.processingType}` : ""}: ₹${parsed.data.cost} per passenger (by ${session.name})`,
        reason
      ),
    });
    return row;
  });
  return jsonSuccess(serializeVendorServiceRate(created), 201);
}
