import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Short prefix shown to the customer as their lead reference — matches the
 * format the frontend already promised users during the M1 mock-API phase
 * (e.g. "OTB-670792", "NV-058517"), now derived from a real Lead id instead
 * of Date.now(). This is a *lead* reference, distinct from Booking.bookingId
 * (formatted TNX-XX-XXXXXX), which only exists once a lead is converted.
 */
const SERVICE_REFERENCE_PREFIX: Record<ServiceType, string> = {
  NEW_VISA: "NV",
  VISA_EXTENSION: "VE",
  VISA_CHANGE: "VC",
  FLIGHT_SPECIAL_FARE: "FF",
  RETURN_TICKET: "RT",
  OTB: "OTB",
  OTHER: "OS",
};

export function formatLeadReference(serviceType: ServiceType, leadId: string): string {
  const suffix = leadId.slice(-6).toUpperCase();
  return `${SERVICE_REFERENCE_PREFIX[serviceType]}-${suffix}`;
}

const REFERENCE_PREFIX_TO_SERVICE: Record<string, ServiceType> = Object.fromEntries(
  Object.entries(SERVICE_REFERENCE_PREFIX).map(([serviceType, prefix]) => [prefix, serviceType as ServiceType])
);

/**
 * Reverse of formatLeadReference() — parses a "PREFIX-SUFFIX" string (e.g.
 * "OTB-058517") back into a serviceType + id suffix a caller can match a
 * Lead against (`id: { endsWith: suffix.toLowerCase() } `). Returns null
 * for anything not shaped like a reference (a customer name, a mobile
 * number, free text, etc.) — callers fall through to their own other
 * matching strategies in that case. Shared by Global Search (Step 24) and
 * the Admin AI Command Center's booking-diagnosis lookup (Step 27) so the
 * parsing logic exists in exactly one place.
 */
export function parseLeadReference(query: string): { serviceType: ServiceType; suffix: string } | null {
  const match = /^([A-Za-z]+)-([A-Za-z0-9]+)$/.exec(query.trim());
  if (!match) return null;
  const serviceType = REFERENCE_PREFIX_TO_SERVICE[match[1].toUpperCase()];
  if (!serviceType) return null;
  return { serviceType, suffix: match[2].toLowerCase() };
}
