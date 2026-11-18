import { db } from "../db";

const AIRPORT_CODE = /^[A-Z0-9]{3,4}$/;

/** The city of each airport code given (from the Airport master); codes not found are left out. */
export async function airportCities(codes: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(codes.map((code) => code.trim().toUpperCase()).filter((code) => AIRPORT_CODE.test(code)))];
  if (unique.length === 0) return new Map();
  const rows = await db.airport.findMany({ where: { code: { in: unique } }, select: { code: true, city: true } });
  return new Map(rows.filter((row) => row.city.trim()).map((row) => [row.code, row.city.trim()]));
}

/** "BLR" → "Bengaluru" with the given map; anything that isn't a known airport code is returned as it is. */
export function cityFor(place: string, cities: Map<string, string>): string {
  const trimmed = place.trim();
  return cities.get(trimmed.toUpperCase()) ?? trimmed;
}

/**
 * Client doc 16 Nov (A8) — customer flight notifications show city names, not airport codes:
 * "BLR → DEL" → "Bengaluru → Delhi" (any number of legs). A part that isn't a known code is kept as it is.
 */
export async function cityRoute(route: string | null | undefined): Promise<string> {
  if (!route) return "";
  const parts = route.split("→").map((part) => part.trim());
  const cities = await airportCities(parts);
  return parts.map((part) => cityFor(part, cities)).join(" → ");
}
