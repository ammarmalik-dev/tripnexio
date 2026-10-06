import type { FlightScope } from "../../generated/prisma/enums";
import { db } from "../db";

export type FlightRouteResult =
  | { ok: true; route: string; flightScope: FlightScope; fromAirportCode: string; toAirportCode: string }
  | { ok: false; field: "fromAirportCode" | "toAirportCode"; error: string };

/**
 * Client corrections 2026-10-05 §9 — a Special Fare route comes from the
 * Airport master, never free text: both codes must be active airports, and
 * the route is DOMESTIC when they're in the same country (else
 * INTERNATIONAL), which picks the Domestic / International T&C.
 */
export async function resolveFlightRoute(fromCode: string, toCode: string): Promise<FlightRouteResult> {
  const from = fromCode.trim().toUpperCase();
  const to = toCode.trim().toUpperCase();
  if (from === to) return { ok: false, field: "toAirportCode", error: "Arrival airport must be different from departure." };
  const airports = await db.airport.findMany({ where: { code: { in: [from, to] }, active: true }, select: { code: true, countryId: true } });
  const fromAirport = airports.find((airport) => airport.code === from);
  const toAirport = airports.find((airport) => airport.code === to);
  if (!fromAirport) return { ok: false, field: "fromAirportCode", error: "Select an active departure airport." };
  if (!toAirport) return { ok: false, field: "toAirportCode", error: "Select an active arrival airport." };
  return {
    ok: true,
    route: `${from} → ${to}`,
    flightScope: fromAirport.countryId === toAirport.countryId ? "DOMESTIC" : "INTERNATIONAL",
    fromAirportCode: from,
    toAirportCode: to,
  };
}

/** The Domestic / International scope of a booking's selected Special Fare quote (null for any other service). */
export async function flightScopeForLead(leadId: string): Promise<FlightScope | null> {
  const quote = await db.quotation.findFirst({
    where: { leadId, isSelected: true, flightScope: { not: null } },
    select: { flightScope: true },
    orderBy: { updatedAt: "desc" },
  });
  return quote?.flightScope ?? null;
}

export const FLIGHT_SCOPE_LABELS: Record<FlightScope, string> = {
  DOMESTIC: "Domestic",
  INTERNATIONAL: "International",
};
