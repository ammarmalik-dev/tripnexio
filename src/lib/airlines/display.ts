import { db } from "../db";

export interface AirlineDisplay {
  name: string;
  logoUrl: string | null;
}

/** Airline name + logo for a set of IATA codes (Airline master), keyed by upper-case code. */
export async function loadAirlineDisplay(codes: (string | null | undefined)[]): Promise<Record<string, AirlineDisplay>> {
  const wanted = [...new Set(codes.filter((code): code is string => Boolean(code)).map((code) => code.trim().toUpperCase()))];
  if (wanted.length === 0) return {};
  const airlines = await db.airline.findMany({ where: { code: { in: wanted } }, select: { code: true, name: true, logoUrl: true } });
  return Object.fromEntries(airlines.map((airline) => [airline.code.toUpperCase(), { name: airline.name, logoUrl: airline.logoUrl }]));
}
