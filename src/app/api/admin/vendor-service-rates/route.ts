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

  const isNewVisa = parsed.data.serviceType === "NEW_VISA";
  const data = {
    ...parsed.data,
    airlineId: parsed.data.serviceType === "OTB" ? (parsed.data.airlineId ?? null) : null,
    nationalityId: isNewVisa ? (parsed.data.nationalityId ?? null) : null,
    paxType: isNewVisa && parsed.data.paxType ? parsed.data.paxType : null,
    newVisaConfigId: isNewVisa ? (parsed.data.newVisaConfigId ?? null) : null,
    processingType: parsed.data.processingType || null,
  };
  const vendor = await db.vendor.findUnique({ where: { id: data.vendorId }, select: { id: true } });
  if (!vendor) return jsonError(400, "Vendor not found.", { vendorId: ["Select a valid vendor."] });
  const country = await db.country.findUnique({ where: { id: data.countryId }, select: { id: true } });
  if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });
  if (data.airlineId && !(await db.airline.findUnique({ where: { id: data.airlineId }, select: { id: true } }))) {
    return jsonError(400, "Airline not found.", { airlineId: ["Select a valid airline."] });
  }
  if (data.nationalityId && !(await db.nationality.findUnique({ where: { id: data.nationalityId }, select: { id: true } }))) {
    return jsonError(400, "Nationality not found.", { nationalityId: ["Select a valid nationality."] });
  }
  // Client doc 2026-10-27 (E2) — the visa option must be one of this country's New Visa options.
  if (data.newVisaConfigId && !(await db.newVisaCountryConfig.findFirst({ where: { id: data.newVisaConfigId, countryId: data.countryId }, select: { id: true } }))) {
    return jsonError(400, "Visa type not found for this country.", { newVisaConfigId: ["Select one of this country's visa options."] });
  }
  const duplicate = await db.vendorServiceRate.findFirst({
    where: {
      vendorId: data.vendorId,
      serviceType: data.serviceType,
      countryId: data.countryId,
      airlineId: data.airlineId,
      nationalityId: data.nationalityId,
      paxType: data.paxType,
      newVisaConfigId: data.newVisaConfigId,
      processingType: data.processingType,
    },
    select: { id: true },
  });
  if (duplicate) return jsonError(400, "This vendor already has this rate — edit it instead.", { countryId: ["Already added."] });

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
