import type { ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";
import { requestedRouteFromDetails } from "../quotations/flight-quote";

export interface TripFact {
  label: string;
  value: string;
}

export interface TripLead {
  serviceType: ServiceType;
  paxCount: number | null;
  travelDate: Date | null;
  details: unknown;
  country: { name: string } | null;
}

function formatTravelDate(date: Date): string {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * Client 2026-10-14 — confirmation emails and WhatsApp messages mention the
 * passenger count, the route (departure → arrival city) or destination, and
 * the travel date. Only facts the lead actually has are returned.
 */
export function tripFacts(lead: TripLead): TripFact[] {
  const facts: TripFact[] = [];
  if (lead.paxCount && lead.paxCount > 0) facts.push({ label: "Passengers", value: String(lead.paxCount) });
  const route = lead.serviceType === "FLIGHT_SPECIAL_FARE" ? requestedRouteFromDetails(lead.details) : null;
  if (route) facts.push({ label: "Route", value: route });
  // Client doc 2026-10-20 (D9) — a Visa Change / Extension happens in the UAE: no "Destination" in its messages.
  else if (lead.country?.name && lead.serviceType !== "VISA_CHANGE" && lead.serviceType !== "VISA_EXTENSION") facts.push({ label: "Destination", value: lead.country.name });
  if (lead.travelDate) facts.push({ label: "Travel date", value: formatTravelDate(lead.travelDate) });
  return facts;
}

/** One line for WhatsApp / plain text, e.g. "Passengers: 2 · Route: Delhi → Dubai · Travel date: 20 Oct 2026". */
export function tripSummaryLine(facts: TripFact[]): string {
  return facts.map((fact) => `${fact.label}: ${fact.value}`).join(" · ");
}

export const TRIP_LEAD_SELECT = { serviceType: true, paxCount: true, travelDate: true, details: true, country: { select: { name: true } } } as const;

/**
 * The {{tripSummary}} notification variable. Never empty (a Meta template rejects an
 * empty parameter): with no trip facts it falls back to the service name.
 */
export async function tripSummaryForLead(leadId: string, fallback: string): Promise<string> {
  const line = tripSummaryLine(await tripFactsForLead(leadId));
  return line || fallback;
}

/** The trip facts of a lead by id; empty when it can't be read (a notification never fails over this). */
export async function tripFactsForLead(leadId: string): Promise<TripFact[]> {
  try {
    const lead = await db.lead.findUnique({ where: { id: leadId }, select: TRIP_LEAD_SELECT });
    return lead ? tripFacts(lead) : [];
  } catch {
    return [];
  }
}
