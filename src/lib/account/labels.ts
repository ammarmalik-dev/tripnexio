import type { BookingStatus, LeadStatus } from "../../generated/prisma/enums";

/**
 * Customer-facing wording for the coarse Lead/Booking status enums — not
 * the internal names verbatim (CRM.md §14's "customer-safe status" idea,
 * kept intentionally simple here rather than wiring the separate granular
 * ServiceStatus/customerLabel catalog, which tracks booking-level
 * processing steps admin configures per service, a bigger integration than
 * this account page needs).
 */
/**
 * Step 49 — both LOST and CLOSED (internal-only distinction: "didn't work
 * out" vs. "manually closed for another reason") read the same to a
 * customer, same as the old map already collapsed LOST into "Closed"
 * rather than a harsher word.
 */
export const CUSTOMER_LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Request received",
  CONTACTED: "Our team is reviewing this",
  FOLLOW_UP_REQUIRED: "Our team is reviewing this",
  CUSTOMER_RESPONDED: "Our team is reviewing this",
  QUALIFIED: "Under review",
  QUOTATION_CREATED: "Quotation ready",
  QUOTATION_ACCEPTED: "Quotation accepted",
  PAYMENT_PENDING: "Payment pending",
  CONVERTED: "Confirmed",
  LOST: "Closed",
  CLOSED: "Closed",
};

export const CUSTOMER_BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Payment pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Being processed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};
