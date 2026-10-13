import { db } from "../db";
import { flightFieldsFromSectors, type ItinerarySegment, type SectorFlightFields } from "../quotations/itinerary";

export type SectorFlightResult = { ok: true; fields: SectorFlightFields } | { ok: false; error: string };

/**
 * Special Fare sectors are the quote's only flight entry (client 2026-10-13):
 * every sector airport must be an active Airport-master code and every
 * airline an active Airline-master code (never free text, client doc §9);
 * the quote's main flight fields are then derived from them.
 */
export async function resolveSectorFlight(segments: ItinerarySegment[]): Promise<SectorFlightResult> {
  const airportCodes = [...new Set(segments.flatMap((segment) => [segment.from.trim().toUpperCase(), segment.to.trim().toUpperCase()]))];
  const airports = await db.airport.findMany({ where: { code: { in: airportCodes }, active: true }, select: { code: true } });
  const known = new Set(airports.map((airport) => airport.code));
  for (const [index, segment] of segments.entries()) {
    if (!known.has(segment.from.trim().toUpperCase()) || !known.has(segment.to.trim().toUpperCase())) {
      return { ok: false, error: `Sector ${index + 1}: select both airports from the Airport master.` };
    }
    if (segment.from.trim().toUpperCase() === segment.to.trim().toUpperCase()) {
      return { ok: false, error: `Sector ${index + 1}: the arrival airport must be different from the departure airport.` };
    }
  }
  const airlineCodes = [...new Set(segments.map((segment) => segment.airline?.trim()).filter((code): code is string => Boolean(code)))];
  if (airlineCodes.length > 0) {
    const airlines = await db.airline.findMany({ where: { code: { in: airlineCodes }, active: true }, select: { code: true } });
    const missing = airlineCodes.find((code) => !airlines.some((airline) => airline.code === code));
    if (missing) return { ok: false, error: `Airline ${missing} isn't an active airline in the Airline master.` };
  }
  const fields = flightFieldsFromSectors(segments);
  if (!fields) return { ok: false, error: "Add at least one flight sector." };
  return { ok: true, fields };
}
