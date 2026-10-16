import type { ServiceType } from "../../generated/prisma/enums";
import { db } from "../db";
import { subServiceLabel } from "../leads/sub-service-label";
import { isUrgentRequest, urgentBadgeLabel } from "./urgency";

const PROCESSING_SERVICES: ReadonlySet<ServiceType> = new Set<ServiceType>(["NEW_VISA", "OTB"]);

/**
 * Client doc 2026-10-15 (C4) — "Normal" / "Urgent" (New Visa: "Express") written under the
 * booking / lead ID in every CRM list; null for services without a processing choice.
 */
export function processingLabel(serviceType: ServiceType, details: unknown): string | null {
  if (!PROCESSING_SERVICES.has(serviceType)) return null;
  if (isUrgentRequest(serviceType, details)) return urgentBadgeLabel(serviceType);
  const value = details && typeof details === "object" && !Array.isArray(details) ? (details as Record<string, unknown>).processingType : null;
  return value === "normal" ? "Normal" : null;
}

const AIRLINE_SERVICES: ReadonlySet<ServiceType> = new Set<ServiceType>(["OTB", "FLIGHT_SPECIAL_FARE", "RETURN_TICKET"]);

export interface SubServiceRow {
  serviceType: ServiceType;
  details: unknown;
  /** The airline already known for the row (e.g. the selected flight quotation's), name or code. */
  airline?: string | null;
}

/**
 * Client doc 2026-10-15 (C4) — the Sub-service column: the visa type / option for visas, the airline
 * name for flights, OTB and Return Ticket. One airline lookup for the whole page.
 */
export async function resolveSubServices(rows: SubServiceRow[]): Promise<(string | null)[]> {
  const airlineOf = (row: SubServiceRow): string | null => {
    if (!AIRLINE_SERVICES.has(row.serviceType)) return null;
    if (row.airline) return row.airline;
    const details = row.details && typeof row.details === "object" ? (row.details as Record<string, unknown>) : {};
    return typeof details.airline === "string" && details.airline.trim() ? details.airline.trim() : null;
  };
  const codes = [...new Set(rows.map(airlineOf).filter((value): value is string => !!value && /^[A-Za-z0-9]{2,3}$/.test(value)))];
  const airlines = codes.length > 0 ? await db.airline.findMany({ where: { code: { in: codes } }, select: { code: true, name: true } }) : [];
  const names = new Map(airlines.map((airline) => [airline.code.toUpperCase(), airline.name]));
  return rows.map((row) => {
    const airline = airlineOf(row);
    if (airline) return names.get(airline.toUpperCase()) ?? airline;
    return subServiceLabel(row.details);
  });
}
