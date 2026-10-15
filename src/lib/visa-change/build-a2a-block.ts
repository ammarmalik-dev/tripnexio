import { db } from "../db";
import { findActiveAirlineByCode } from "../airlines/find-active-airline";
import type { A2AFlightsInput } from "./a2a-flights";
import type { A2ABlock } from "./operational";

type BuildResult = { ok: true; block: A2ABlock } | { ok: false; field: keyof A2AFlightsInput; error: string };

const airportLabel = (airport: { name: string; code: string }) => `${airport.name} (${airport.code})`;

/**
 * Client testing 2026-10-09 (B32) — turns one quote option's exit and
 * re-entry flights into the operational block stored on that quotation
 * (Quotation.operationalBlock): airports from the Airport master, airlines
 * from the Airline master, and the option's own vendor, cost and selling
 * price. The selected option's block is what the booking, the customer quote
 * page and the package PDF show.
 */
export async function buildA2ABlockForQuote(
  input: A2AFlightsInput,
  commercial: { vendorId: string; vendorName: string; cost: number; sellingPrice: number }
): Promise<BuildResult> {
  const codes = {
    exitFrom: input.exitFromAirportCode.trim().toUpperCase(),
    exitTo: input.exitToAirportCode.trim().toUpperCase(),
    reentryFrom: input.reentryFromAirportCode.trim().toUpperCase(),
    reentryTo: input.reentryToAirportCode.trim().toUpperCase(),
  };
  const airports = await db.airport.findMany({
    where: { code: { in: [...new Set(Object.values(codes))] }, active: true },
    select: { id: true, code: true, name: true },
  });
  const find = (code: string) => airports.find((airport) => airport.code === code);
  const exitFrom = find(codes.exitFrom);
  const exitTo = find(codes.exitTo);
  const reentryFrom = find(codes.reentryFrom);
  const reentryTo = find(codes.reentryTo);
  if (!exitFrom) return { ok: false, field: "exitFromAirportCode", error: "Select an active exit airport." };
  if (!exitTo) return { ok: false, field: "exitToAirportCode", error: "Select an active airport for where the exit flight lands." };
  if (!reentryFrom) return { ok: false, field: "reentryFromAirportCode", error: "Select an active airport for where the re-entry flight departs." };
  if (!reentryTo) return { ok: false, field: "reentryToAirportCode", error: "Select an active re-entry airport." };

  const exitAirline = await findActiveAirlineByCode(input.exitAirlineCode);
  if (!exitAirline) return { ok: false, field: "exitAirlineCode", error: "Select a valid, active airline for the exit flight." };
  const reentryAirline =
    input.reentryAirlineCode.trim().toUpperCase() === exitAirline.code.toUpperCase() ? exitAirline : await findActiveAirlineByCode(input.reentryAirlineCode);
  if (!reentryAirline) return { ok: false, field: "reentryAirlineCode", error: "Select a valid, active airline for the re-entry flight." };

  return {
    ok: true,
    block: {
      kind: "A2A",
      exitAirportId: exitFrom.id,
      exitAirportCode: exitFrom.code,
      exitAirport: airportLabel(exitFrom),
      exitToAirportCode: exitTo.code,
      exitToAirport: airportLabel(exitTo),
      reentryFromAirportCode: reentryFrom.code,
      reentryFromAirport: airportLabel(reentryFrom),
      entryAirportId: reentryTo.id,
      entryAirportCode: reentryTo.code,
      entryAirport: airportLabel(reentryTo),
      airlineCode: exitAirline.code,
      airline: exitAirline.name,
      flightNumber: input.exitFlightNumber.trim().toUpperCase(),
      flightDate: input.exitDepartAt.slice(0, 10),
      flightTime: input.exitDepartAt.slice(11, 16),
      returnAirlineCode: reentryAirline.code,
      returnAirline: reentryAirline.name,
      returnFlightNumber: input.reentryFlightNumber.trim().toUpperCase(),
      returnFlightDate: input.reentryDepartAt.slice(0, 10),
      returnFlightTime: input.reentryDepartAt.slice(11, 16),
      reportingTime: input.reportingTime?.trim() ?? "",
      terminal: input.exitTerminal?.trim() || null,
      returnTerminal: input.reentryTerminal?.trim() || null,
      vendorId: commercial.vendorId,
      vendorName: commercial.vendorName,
      cost: commercial.cost,
      sellingPrice: commercial.sellingPrice,
    },
  };
}
