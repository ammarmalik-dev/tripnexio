import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { createVendorServiceRateSchema, serializeVendorServiceRate, VENDOR_RATE_INCLUDE } from "@/lib/vendors/service-rates";

/**
 * Client doc 2026-10-14 — vendor rates for OTB / Return Ticket by vendor,
 * country, airline and processing type. Internal cost data: Admin only
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

  const data = { ...parsed.data, airlineId: parsed.data.airlineId ?? null, processingType: parsed.data.processingType || null };
  const vendor = await db.vendor.findUnique({ where: { id: data.vendorId }, select: { id: true } });
  if (!vendor) return jsonError(400, "Vendor not found.", { vendorId: ["Select a valid vendor."] });
  const country = await db.country.findUnique({ where: { id: data.countryId }, select: { id: true } });
  if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });
  if (data.airlineId && !(await db.airline.findUnique({ where: { id: data.airlineId }, select: { id: true } }))) {
    return jsonError(400, "Airline not found.", { airlineId: ["Select a valid airline."] });
  }
  const duplicate = await db.vendorServiceRate.findFirst({
    where: { vendorId: data.vendorId, serviceType: data.serviceType, countryId: data.countryId, airlineId: data.airlineId, processingType: data.processingType },
    select: { id: true },
  });
  if (duplicate) return jsonError(400, "This vendor already has a rate for that country, airline and processing type — edit it instead.", { countryId: ["Already added."] });

  const created = await db.$transaction(async (tx) => {
    const row = await tx.vendorServiceRate.create({ data, include: VENDOR_RATE_INCLUDE });
    await writeAudit(tx, {
      entityType: "VendorServiceRate",
      entityId: row.id,
      action: "CREATE",
      byUserId: session.id,
      note: withReason(
        `Vendor rate ${row.vendor.name} · ${row.serviceType} · ${row.country.name}${row.airline ? ` · ${row.airline.code}` : ""}${row.processingType ? ` · ${row.processingType}` : ""}: ₹${parsed.data.cost} per passenger (by ${session.name})`,
        reason
      ),
    });
    return row;
  });
  return jsonSuccess(serializeVendorServiceRate(created), 201);
}
