import type { NextRequest } from "next/server";
import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getNewVisaDestinations } from "@/lib/new-visa/destinations";

/**
 * Public, unauthenticated — read-only reference data for customer-facing
 * destination-country dropdowns (website forms, WhatsApp bot). Active-only,
 * ordered. No sensitive fields on Country, so no session check needed.
 */
export async function GET(request: NextRequest) {
  // Client testing 2026-10-09 (B17) — ?service=OTB: only the countries Admin
  // priced OTB for (any active OTB airline). OTB is priced only per country ×
  // airline (client reply 2026-10-13), so an unpriced country can't be booked.
  const service = request.nextUrl.searchParams.get("service");
  // Client doc 2026-10-20 (E5) — ?service=NEW_VISA: only the New Visa destinations Admin made live.
  if (service === "NEW_VISA") {
    const destinations = await getNewVisaDestinations();
    return jsonSuccess(destinations.map(({ code, name, flagOverride }) => ({ code, name, flagOverride })));
  }
  let otbCountryIds: string[] | null = null;
  if (service === "OTB") {
    const priced = await db.otbPrice.findMany({
      where: { active: true, airline: { active: true } },
      distinct: ["countryId"],
      select: { countryId: true },
    });
    otbCountryIds = priced.map((row) => row.countryId);
  }
  const countries = await db.country.findMany({
    where: { active: true, ...(otbCountryIds ? { id: { in: otbCountryIds } } : {}) },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, flagOverride: true },
  });
  return jsonSuccess(countries);
}
