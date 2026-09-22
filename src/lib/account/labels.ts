import type { BookingStatus, LeadStatus } from "../../generated/prisma/enums";

/**
 * Customer-facing wording for the coarse Lead/Booking status enums — not
 * the internal names verbatim (CRM.md §14's "customer-safe status" idea,
 * kept intentionally simple here rather than wiring the separate granular
 * ServiceStatus/customerLabel catalog, which tracks booking-level
 * processing steps admin configures per service, a bigger integration than
 * this account page needs).
 */
export const CUSTOMER_LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Request received",
  CONTACTED: "Our team is reviewing this",
  QUALIFIED: "Under review",
  QUOTED: "Quotation ready",
  CONVERTED: "Confirmed",
  ON_HOLD: "On hold",
  LOST: "Closed",
};

export const CUSTOMER_BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Payment pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Being processed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};
