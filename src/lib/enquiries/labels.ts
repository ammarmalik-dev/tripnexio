import type { EnquiryCategory, EnquiryStatus } from "../../generated/prisma/enums";

/** Client-safe labels for Contact-form enquiries. */
export const ENQUIRY_CATEGORY_LABELS: Record<EnquiryCategory, string> = {
  GENERAL: "General Enquiry",
  BOOKING: "Booking",
  PAYMENT: "Payment",
  DOCUMENTS: "Documents",
  FEEDBACK: "Feedback",
  COMPLAINT: "Complaint",
};

/** Order on the public Contact form and in CRM filters. */
export const ENQUIRY_CATEGORIES: EnquiryCategory[] = ["GENERAL", "BOOKING", "PAYMENT", "DOCUMENTS", "FEEDBACK", "COMPLAINT"];

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  NEW: "New",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  CONVERTED: "Converted to Lead",
};

/** Statuses staff can set by hand (CONVERTED only comes from "Convert to Lead"). */
export const ENQUIRY_MANUAL_STATUSES: EnquiryStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"];

/** ENQ-XXXXXX, or CMP-XXXXXX for a complaint — derived from the row id. */
export function enquiryReference(id: string, category: EnquiryCategory): string {
  return `${category === "COMPLAINT" ? "CMP" : "ENQ"}-${id.slice(-6).toUpperCase()}`;
}
