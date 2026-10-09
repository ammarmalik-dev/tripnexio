import type { NextRequest } from "next/server";
import { jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { countryFlag } from "@/lib/countries/flag";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

/**
 * Public, unauthenticated airport search for the customer-facing
 * departure/arrival dropdowns (Special Fare). Read-only reference data —
 * active airports of countries enabled in Admin only (client testing
 * 2026-10-09, B8), matched on name, city, IATA code or country, with the
 * country's flag.
 */
export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
  if (query.length < 2) return jsonSuccess([]);

  const airports = await db.airport.findMany({
    where: {
      active: true,
      countryRef: { active: true },
      OR: [
        { code: { startsWith: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
        { country: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [{ displayOrder: "asc" }, { city: "asc" }, { name: "asc" }],
    take: limit,
    select: { id: true, name: true, code: true, city: true, country: true, countryRef: { select: { code: true, flagOverride: true } } },
  });
  return jsonSuccess(airports.map(({ countryRef, ...airport }) => ({ ...airport, flag: countryFlag(countryRef) })));
}
