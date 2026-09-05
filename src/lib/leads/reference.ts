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
};

export function formatLeadReference(serviceType: ServiceType, leadId: string): string {
  const suffix = leadId.slice(-6).toUpperCase();
  return `${SERVICE_REFERENCE_PREFIX[serviceType]}-${suffix}`;
}
