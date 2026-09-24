import type { ServiceType } from "../../generated/prisma/enums";

/** Matches the schema's own doc comment: "Formatted like TNX-XX-XXXXXX (XX = a service-type short code, e.g. NV, OT, VE)". */
const BOOKING_SERVICE_CODE: Record<ServiceType, string> = {
  NEW_VISA: "NV",
  VISA_EXTENSION: "VE",
  VISA_CHANGE: "VC",
  FLIGHT_SPECIAL_FARE: "FF",
  RETURN_TICKET: "RT",
  OTB: "OT",
  OTHER: "OS",
};

/**
 * Derives the real TNX-XX-XXXXXX booking reference from the Lead's own id —
 * not the Booking row's own id — per CRM.md §5/§7/§19's locked rule: "Lead
 * ID generated immediately; on successful payment, Lead ID becomes Booking
 * ID — do NOT generate a second unrelated Booking ID." The 6-character
 * suffix here is the exact same one `formatLeadReference` (src/lib/leads/
 * reference.ts) already derived for the customer-facing Lead reference
 * (e.g. Lead `OTB-JYOQHX` → Booking `TNX-OT-JYOQHX`) — one continuous
 * identifying number carried from Lead through to Booking, just re-cased
 * into the schema's own documented TNX-XX-XXXXXX booking format (which
 * itself is locked — see the Prisma schema's doc comment and
 * Visa_Change.md's own TNX-VC-XXXXXX example).
 */
export function formatBookingId(serviceType: ServiceType, leadId: string): string {
  const suffix = leadId.slice(-6).toUpperCase();
  return `TNX-${BOOKING_SERVICE_CODE[serviceType]}-${suffix}`;
}

/**
 * Placeholder assigned at Booking creation — `bookingId` is a required,
 * unique column with no DB default, and a booking that hasn't been paid
 * for yet has no "real" identity per the locked rule above (it only
 * becomes the Lead's id "on successful payment"). Replaced by
 * `formatBookingId` once payment succeeds (see src/lib/payments/
 * complete-payment.ts).
 */
export function placeholderBookingId(): string {
  return `PENDING-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
}
