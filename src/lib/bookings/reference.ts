import type { ServiceType } from "../../generated/prisma/enums";

/** Matches the schema's own doc comment: "Formatted like TNX-XX-XXXXXX (XX = a service-type short code, e.g. NV, OT, VE)". */
const BOOKING_SERVICE_CODE: Record<ServiceType, string> = {
  NEW_VISA: "NV",
  VISA_EXTENSION: "VE",
  VISA_CHANGE: "VC",
  FLIGHT_SPECIAL_FARE: "FF",
  RETURN_TICKET: "RT",
  OTB: "OT",
};

export function formatBookingId(serviceType: ServiceType, bookingId: string): string {
  const suffix = bookingId.slice(-6).toUpperCase();
  return `TNX-${BOOKING_SERVICE_CODE[serviceType]}-${suffix}`;
}

/**
 * Placeholder assigned at Booking creation — `bookingId` is a required,
 * unique column with no DB default, but the real TNX-XX-XXXXXX id can only
 * be derived once the row (and its own `id`) exists. This placeholder is
 * independent of the row's id and gets replaced by `formatBookingId` once
 * payment succeeds (see src/lib/bookings/create-booking.ts).
 */
export function placeholderBookingId(): string {
  return `PENDING-${crypto.randomUUID().slice(0, 10).toUpperCase()}`;
}
