import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { computeVendorScore, getVendorScoringWeights } from "@/lib/vendors/scoring";
import type { ServiceType } from "@/generated/prisma/enums";
import { DIRECT_VENDOR_NAME } from "@/lib/bookings/vendor-names";
import { resolveLeadSubServiceCodes } from "@/lib/vendors/sub-service-scope";
import { vendorCoversSubService } from "@/lib/vendors/sub-service-match";

const SERVICE_TYPES: ServiceType[] = [
  "NEW_VISA",
  "VISA_EXTENSION",
  "VISA_CHANGE",
  "FLIGHT_SPECIAL_FARE",
  "RETURN_TICKET",
  "OTB",
];

export async function GET(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const { searchParams } = new URL(request.url);
  const service = searchParams.get("service");
  if (service && !SERVICE_TYPES.includes(service as ServiceType)) {
    return jsonError(400, "Invalid service query parameter.");
  }

  // Admin handover §12 — `?leadId=` / `?bookingId=` (with `?service=`) narrows the list to vendors
  // whose link to that service covers the lead's sub-service (empty link list = every sub-service).
  const leadId = searchParams.get("leadId");
  const bookingId = searchParams.get("bookingId");
  let leadCodes: string[] = [];
  if (service && (leadId || bookingId)) {
    try {
      const lead = leadId
        ? await db.lead.findUnique({ where: { id: leadId }, select: { serviceType: true, details: true } })
        : (await db.booking.findUnique({ where: { id: bookingId ?? "" }, select: { lead: { select: { serviceType: true, details: true } } } }))?.lead ?? null;
      if (lead && lead.serviceType === service) leadCodes = await resolveLeadSubServiceCodes(lead.serviceType, lead.details);
    } catch {
      return jsonError(500, "Couldn't load vendors.");
    }
  }

  const vendors = await db.vendor.findMany({
    where: {
      active: true,
      // Client doc 2026-10-15 (I7) — only real vendors, never the auto-priced placeholder.
      name: { not: DIRECT_VENDOR_NAME },
      ...(service ? { services: { some: { service: service as ServiceType } } } : {}),
    },
    include: { services: { select: { service: true, subServiceCodes: true } } },
    orderBy: { name: "asc" },
  });
  const eligible =
    leadCodes.length > 0
      ? vendors.filter((vendor) => vendorCoversSubService(vendor.services.find((entry) => entry.service === service)?.subServiceCodes ?? [], leadCodes))
      : vendors;

  // Business Rules §8 "Vendor Selection" — sorted by overall recommendation
  // score (highest first) as a display/sort aid only; staff still pick
  // whichever vendor they want from the full list, this never auto-selects.
  const weights = await getVendorScoringWeights();
  const scored = eligible
    .map((vendor) => ({ id: vendor.id, name: vendor.name, score: computeVendorScore(vendor, weights) }))
    .sort((a, b) => b.score - a.score);

  return jsonSuccess(scored);
}
