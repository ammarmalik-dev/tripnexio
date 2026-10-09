import type { ServiceStatusSystemEvent } from "../service-status/events";
import type { ServiceType } from "../../generated/prisma/enums";

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

/**
 * Client testing 2026-10-09 (E11) — the outputs each service can deliver
 * (first = the usual one): a ticket on a ticket booking, a visa on a visa
 * booking. The form offers only these and the server refuses anything else.
 */
export const OUTPUTS_BY_SERVICE: Record<ServiceType, readonly OutputType[]> = {
  NEW_VISA: ["VISA_PDF"],
  VISA_EXTENSION: ["EXTENDED_VISA_PDF"],
  VISA_CHANGE: ["PACKAGE_PDF", "VISA_PDF"],
  FLIGHT_SPECIAL_FARE: ["TICKET_PDF"],
  RETURN_TICKET: ["RESERVATION_PDF", "TICKET_PDF"],
  OTB: ["OTB_CONFIRMATION"],
  OTHER: OUTPUT_TYPES,
};

/** The output each service normally delivers — the Upload & Deliver form's default choice. */
export const DEFAULT_OUTPUT_BY_SERVICE: Record<ServiceType, OutputType> = {
  NEW_VISA: "VISA_PDF",
  VISA_EXTENSION: "EXTENDED_VISA_PDF",
  VISA_CHANGE: "PACKAGE_PDF",
  FLIGHT_SPECIAL_FARE: "TICKET_PDF",
  RETURN_TICKET: "RESERVATION_PDF",
  OTB: "OTB_CONFIRMATION",
  OTHER: "VISA_PDF",
};

export function isOutputType(type: string): type is OutputType {
  return (OUTPUT_TYPES as readonly string[]).includes(type);
}
