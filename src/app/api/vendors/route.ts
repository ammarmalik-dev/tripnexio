import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";
import { computeVendorScore, getVendorScoringWeights } from "@/lib/vendors/scoring";
import type { ServiceType } from "@/generated/prisma/enums";

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

  const vendors = await db.vendor.findMany({
    where: {
      active: true,
      ...(service ? { services: { some: { service: service as ServiceType } } } : {}),
    },
    orderBy: { name: "asc" },
  });

  // Business Rules §8 "Vendor Selection" — sorted by overall recommendation
  // score (highest first) as a display/sort aid only; staff still pick
  // whichever vendor they want from the full list, this never auto-selects.
  const weights = await getVendorScoringWeights();
  const scored = vendors
    .map((vendor) => ({ id: vendor.id, name: vendor.name, score: computeVendorScore(vendor, weights) }))
    .sort((a, b) => b.score - a.score);

  return jsonSuccess(scored);
}
