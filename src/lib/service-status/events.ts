/**
 * P08 — system events that move a Lead/Booking along its per-service status
 * list. Each ServiceStatus row may name the event that lands a record on it
 * (ServiceStatus.systemEvent, Admin-editable); the engine looks the target
 * up per service and scope, so no status name is hard-coded in code.
 */
export const SERVICE_STATUS_SYSTEM_EVENTS = [
  "QUOTATION_CREATED",
  "QUOTATION_ACCEPTED",
  "PAYMENT_SUCCESS",
  "DOCUMENTS_REQUESTED",
  "DOCUMENTS_RECEIVED",
  "DOCUMENTS_VALIDATED",
  // P09 — staff delivered an output document of that type.
  "DELIVERED_VISA_PDF",
  "DELIVERED_EXTENDED_VISA_PDF",
  "DELIVERED_TICKET_PDF",
  "DELIVERED_RESERVATION_PDF",
  "DELIVERED_PACKAGE_PDF",
  "DELIVERED_OTB_CONFIRMATION",
] as const;

export type ServiceStatusSystemEvent = (typeof SERVICE_STATUS_SYSTEM_EVENTS)[number];

/** systemEvent value marking a service's "On Hold" status — system events never move a record out of it. */
export const HOLD_MARKER = "ON_HOLD" as const;

export const SYSTEM_EVENT_LABELS: Record<ServiceStatusSystemEvent | typeof HOLD_MARKER, string> = {
  QUOTATION_CREATED: "Quotation created",
  QUOTATION_ACCEPTED: "Quotation accepted",
  PAYMENT_SUCCESS: "Payment successful",
  DOCUMENTS_REQUESTED: "Documents requested",
  DOCUMENTS_RECEIVED: "Documents received",
  DOCUMENTS_VALIDATED: "Documents validated",
  DELIVERED_VISA_PDF: "Visa PDF delivered",
  DELIVERED_EXTENDED_VISA_PDF: "Extended visa PDF delivered",
  DELIVERED_TICKET_PDF: "Ticket PDF delivered",
  DELIVERED_RESERVATION_PDF: "Reservation PDF delivered",
  DELIVERED_PACKAGE_PDF: "Package PDF delivered",
  DELIVERED_OTB_CONFIRMATION: "OTB confirmation delivered",
  ON_HOLD: "On Hold (marker)",
};
