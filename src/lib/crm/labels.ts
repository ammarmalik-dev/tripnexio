import type { ServiceType, LeadStatus } from "../../generated/prisma/enums";

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
