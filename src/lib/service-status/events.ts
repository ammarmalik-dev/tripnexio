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
  // P11 — New Visa embassy actions staff take on a booking.
  "EMBASSY_APPLIED",
  "EMBASSY_ADDITIONAL_DOCS",
  "EMBASSY_RESUBMITTED",
  "EMBASSY_APPROVED",
  "EMBASSY_REJECTED",
  // P13 — Visa Extension outcomes staff record on a booking.
  "EXTENSION_EXTENDED",
  "EXTENSION_NOT_ACCEPTED",
  "EXTENSION_REJECTED",
  // P14 — Visa Change: staff marked the exit done.
  "VC_EXIT_COMPLETED",
  // P16 — Flight Special Fare post-payment operations.
  "FSF_FINAL_CONFIRMATION",
  "FSF_AVAILABILITY_CONFIRMED",
  "FSF_ALTERNATIVE_OFFERED",
  "FSF_ADDITIONAL_PAYMENT_PENDING",
  "FSF_REFUND_PENDING",
  "FSF_PNR_RECORDED",
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
  EMBASSY_APPLIED: "Embassy: applied",
  EMBASSY_ADDITIONAL_DOCS: "Embassy: additional documents required",
  EMBASSY_RESUBMITTED: "Embassy: re-submitted",
  EMBASSY_APPROVED: "Embassy: visa approved",
  EMBASSY_REJECTED: "Embassy: rejected",
  EXTENSION_EXTENDED: "Extension: extended",
  EXTENSION_NOT_ACCEPTED: "Extension: not accepted",
  EXTENSION_REJECTED: "Extension: rejected",
  VC_EXIT_COMPLETED: "Visa Change: exit completed",
  FSF_FINAL_CONFIRMATION: "Special Fare: awaiting final confirmation",
  FSF_AVAILABILITY_CONFIRMED: "Special Fare: availability confirmed",
  FSF_ALTERNATIVE_OFFERED: "Special Fare: alternative offered",
  FSF_ADDITIONAL_PAYMENT_PENDING: "Special Fare: additional payment pending",
  FSF_REFUND_PENDING: "Special Fare: refund pending",
  FSF_PNR_RECORDED: "Special Fare: PNR recorded",
  ON_HOLD: "On Hold (marker)",
};
