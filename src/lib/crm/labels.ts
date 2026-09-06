import type { ServiceType, LeadStatus, DocumentStatus, BookingStatus, PaxType } from "../../generated/prisma/enums";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  NEW_VISA: "New Visa",
  VISA_EXTENSION: "Visa Extension",
  VISA_CHANGE: "Visa Change",
  FLIGHT_SPECIAL_FARE: "Flight Special Fare",
  RETURN_TICKET: "Return Ticket",
  OTB: "OTB",
};

export const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = (
  Object.entries(SERVICE_TYPE_LABELS) as [ServiceType, string][]
).map(([value, label]) => ({ value, label }));

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  QUOTED: "Quoted",
  CONVERTED: "Converted",
  ON_HOLD: "On Hold",
  LOST: "Lost",
};

export const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = (
  Object.entries(LEAD_STATUS_LABELS) as [LeadStatus, string][]
).map(([value, label]) => ({ value, label }));

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  REQUIRED: "Required",
  MISSING: "Missing",
  RECEIVED: "Received",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const PAX_TYPE_LABELS: Record<PaxType, string> = {
  ADULT: "Adult",
  CHILD: "Child",
};
