import type { NextRequest } from "next/server";
import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";

/**
 * Public, unauthenticated — read-only reference data for customer-facing
 * destination-country dropdowns (website forms, WhatsApp bot). Active-only,
 * ordered. No sensitive fields on Country, so no session check needed.
 */
export async function GET(request: NextRequest) {
  // Client testing 2026-10-09 (B17) — ?service=OTB: only the countries Admin
  // priced OTB for (any active OTB airline); all active countries until any
  // OTB price exists, so the form never ends up empty.
  const service = request.nextUrl.searchParams.get("service");
  let otbCountryIds: string[] | null = null;
  if (service === "OTB") {
    const priced = await db.otbPrice.findMany({
      where: { active: true, airline: { active: true, otbRequired: true } },
      distinct: ["countryId"],
      select: { countryId: true },
    });
    if (priced.length > 0) otbCountryIds = priced.map((row) => row.countryId);
  }
  const countries = await db.country.findMany({
    where: { active: true, ...(otbCountryIds ? { id: { in: otbCountryIds } } : {}) },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, flagOverride: true },
  });
  return jsonSuccess(countries);
}
