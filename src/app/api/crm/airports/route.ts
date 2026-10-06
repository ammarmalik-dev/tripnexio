import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/auth/staff-session";

/**
 * Client corrections 2026-10-05 §8-9 — every active airport from the Airport
 * master for CRM pickers (Special Fare route, itinerary sectors), so staff
 * never type a free-text airport. Staff-gated; reference data only.
 */
export async function GET() {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const airports = await db.airport.findMany({
    where: { active: true },
    orderBy: [{ countryRef: { name: "asc" } }, { displayOrder: "asc" }, { city: "asc" }, { name: "asc" }],
    select: { code: true, name: true, city: true, countryRef: { select: { name: true } } },
  });
  // Grouped by the Country master (the same country link that decides Domestic vs International).
  return jsonSuccess(airports.map((airport) => ({ code: airport.code, name: airport.name, city: airport.city, country: airport.countryRef.name })));
}
