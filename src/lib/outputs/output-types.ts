import type { ServiceStatusSystemEvent } from "../service-status/events";

/**
 * P09 — documents TripNexio delivers TO the customer (the service result),
 * stored as Document.type. Delivering one moves the booking to the status
 * of its service marked with the matching DELIVERED_* system event.
 */
export const OUTPUT_TYPES = ["VISA_PDF", "EXTENDED_VISA_PDF", "TICKET_PDF", "RESERVATION_PDF", "PACKAGE_PDF", "OTB_CONFIRMATION"] as const;

export type OutputType = (typeof OUTPUT_TYPES)[number];

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  VISA_PDF: "Visa",
  EXTENDED_VISA_PDF: "Extended visa",
  TICKET_PDF: "Ticket",
  RESERVATION_PDF: "Reservation",
  PACKAGE_PDF: "Service package",
  OTB_CONFIRMATION: "OTB confirmation",
};

export const OUTPUT_DELIVERY_EVENT: Record<OutputType, ServiceStatusSystemEvent> = {
  VISA_PDF: "DELIVERED_VISA_PDF",
  EXTENDED_VISA_PDF: "DELIVERED_EXTENDED_VISA_PDF",
  TICKET_PDF: "DELIVERED_TICKET_PDF",
  RESERVATION_PDF: "DELIVERED_RESERVATION_PDF",
  PACKAGE_PDF: "DELIVERED_PACKAGE_PDF",
  OTB_CONFIRMATION: "DELIVERED_OTB_CONFIRMATION",
};

export function isOutputType(type: string): type is OutputType {
  return (OUTPUT_TYPES as readonly string[]).includes(type);
}
