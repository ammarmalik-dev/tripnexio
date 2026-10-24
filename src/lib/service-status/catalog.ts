import type { BookingStatus, LeadStatus, ServiceType, StatusScope } from "../../generated/prisma/enums";

/**
 * Client doc 2026-10-20 — each service's final status list (internal CRM status, what the customer
 * sees, and whether a message goes out), exactly as the client handed it over. It is loaded into
 * ServiceStatus by migration `20261021090000_client_status_lists` (generated from this file by
 * `scripts/status-catalog-sql.ts`) and stays Admin-editable afterwards; the tests check this file
 * against the template catalog so every status that notifies has its email + WhatsApp template.
 *
 * `from` lists the earlier status names a row takes over (the first one still present is renamed,
 * so its id, history and transitions stay; records on the others are moved onto it).
 */
export interface CatalogStatus {
  name: string;
  customerLabel: string;
  /** NotificationTemplate event sent when a record enters the status; null = internal only (no message). */
  notify: string | null;
  systemEvent?: string;
  maps?: LeadStatus | BookingStatus;
  terminal?: boolean;
  blocksRefund?: boolean;
  from?: string[];
}

export interface CatalogList {
  serviceType: ServiceType;
  scope: StatusScope;
  statuses: CatalogStatus[];
}

const HOLD = "ON_HOLD";

/** Lead-stage closers shared by every service: paid (the booking takes over) or dropped. */
const leadPaid = (from: string[] = ["Converted"]): CatalogStatus => ({
  name: "Paid",
  customerLabel: "Payment Received",
  notify: null,
  systemEvent: "PAYMENT_SUCCESS",
  maps: "CONVERTED",
  terminal: true,
  from,
});
const leadCancelled: CatalogStatus = { name: "Cancelled", customerLabel: "Cancelled", notify: null, maps: "LOST", terminal: true, from: ["Lost", "Closed"] };
const leadHold: CatalogStatus = { name: "On Hold", customerLabel: "Booking On Hold", notify: null, systemEvent: HOLD, from: ["On Hold"] };

/** The cancellation / refund tail every booking list ends with (names per the client's lists). */
function refundTail(prefix: string, opts: { partial?: string; requested?: string; requestedLabel?: string }) {
  return [
    { name: "Cancellation Requested", customerLabel: opts.requestedLabel ?? "Cancellation Under Review", notify: opts.requested ?? `${prefix}_CANCELLATION_REQUESTED` },
    { name: "Partially Cancelled", customerLabel: "Partially Cancelled", notify: opts.partial ?? `${prefix}_PARTIALLY_CANCELLED`, systemEvent: "REFUND_PARTIALLY_COMPLETED" },
  ] satisfies CatalogStatus[];
}

export const STATUS_CATALOG: CatalogList[] = [
  // ───────────────────────────── New Visa ─────────────────────────────
  {
    serviceType: "NEW_VISA",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "Payment Pending", notify: "NV_COUNTRY_REQUEST_PAYMENT_PENDING", maps: "NEW", from: ["New", "Contacted", "Customer Responded", "Qualified", "Quotation Created", "Quotation Accepted", "Payment Pending"] },
      { name: "User Not Responding", customerLabel: "User Not Responding", notify: "NV_USER_NOT_RESPONDING", maps: "FOLLOW_UP_REQUIRED", from: ["Follow-up Required"] },
      leadPaid(),
      leadCancelled,
      leadHold,
    ],
  },
  {
    serviceType: "NEW_VISA",
    scope: "BOOKING",
    statuses: [
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: null, maps: "PENDING", from: ["Payment Pending", "Draft"] },
      { name: "Paid", customerLabel: "Payment Received", notify: "NV_PAYMENT_RECEIVED", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Payment Received"] },
      { name: "User Not Responding", customerLabel: "User Not Responding", notify: "NV_USER_NOT_RESPONDING", maps: "CONFIRMED" },
      { name: "Documents Pending", customerLabel: "Documents Required", notify: "NV_DOCUMENTS_PENDING", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED", from: ["Documents Pending"] },
      { name: "Documents Required", customerLabel: "Documents Required", notify: "NV_DOCUMENTS_REQUIRED", systemEvent: "DOCUMENTS_REJECTED", maps: "CONFIRMED" },
      { name: "Documents Uploaded", customerLabel: "Documents Received", notify: null, systemEvent: "DOCUMENTS_RECEIVED", maps: "CONFIRMED", from: ["Documents Received", "OCR / Validation", "Staff Verification"] },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: "NV_DOCUMENTS_VALIDATED", systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED" },
      { name: "Ready for Submission", customerLabel: "Application Being Prepared", notify: null, systemEvent: "READY_FOR_SUBMISSION", maps: "CONFIRMED", from: ["Ready for Submission"] },
      { name: "Applied to Embassy", customerLabel: "Applied to Embassy", notify: "NV_APPLIED_TO_EMBASSY", systemEvent: "EMBASSY_APPLIED", maps: "PROCESSING", blocksRefund: true, from: ["Submitted to Embassy", "Embassy Reviewing"] },
      { name: "Additional Documents Required", customerLabel: "Additional Documents Required", notify: "NV_ADDITIONAL_DOCUMENTS_REQUIRED", systemEvent: "EMBASSY_ADDITIONAL_DOCS", maps: "PROCESSING", blocksRefund: true, from: ["Additional Document Requested", "Customer Upload Pending"] },
      { name: "Additional Documents Submitted", customerLabel: "Additional Documents Submitted", notify: "NV_ADDITIONAL_DOCUMENTS_SUBMITTED", systemEvent: "ADDITIONAL_DOCUMENTS_RECEIVED", maps: "PROCESSING", blocksRefund: true, from: ["Re-submitted"] },
      { name: "Additional Documents Validated", customerLabel: "Additional Documents Validated", notify: null, systemEvent: "ADDITIONAL_DOCUMENTS_VALIDATED", maps: "PROCESSING", blocksRefund: true, from: ["Re-validation"] },
      { name: "Visa Approved for Partial Applicants", customerLabel: "Visa Approved for Partial Applicants", notify: "NV_PARTIAL_APPROVAL", systemEvent: "PARTIAL_APPROVED", maps: "PROCESSING", blocksRefund: true },
      { name: "Visa Application Approved", customerLabel: "Visa Approved", notify: "NV_VISA_APPROVED", systemEvent: "DELIVERED_VISA_PDF", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["Approved", "Visa PDF Delivered", "Completed"] },
      { name: "Visa Application Rejected", customerLabel: "Visa Application Rejected", notify: "NV_VISA_REJECTED", systemEvent: "EMBASSY_REJECTED", maps: "CANCELLED", terminal: true, blocksRefund: true, from: ["Rejected"] },
      { name: "On Hold", customerLabel: "Booking On Hold", notify: "NV_ON_HOLD", systemEvent: HOLD, from: ["On Hold", "Booking On Hold"] },
      ...refundTail("NV", { partial: "NV_PARTIAL_CANCELLATION" }),
      { name: "Cancelled", customerLabel: "Cancelled", notify: "NV_CANCELLED", systemEvent: "CANCELLED", maps: "CANCELLED" },
      { name: "Refund Pending", customerLabel: "Refund Processing", notify: null, systemEvent: "REFUND_RAISED" },
      { name: "Refund Completed", customerLabel: "Refund Completed", notify: "NV_REFUND_COMPLETED", systemEvent: "REFUND_COMPLETED" },
      { name: "Cancelled and Refunded", customerLabel: "Booking Cancelled — Refund Completed", notify: null, systemEvent: "CANCELLED_AND_REFUNDED", maps: "REFUNDED", terminal: true },
    ],
  },

  // ───────────────────────────── Visa Change ─────────────────────────────
  {
    serviceType: "VISA_CHANGE",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "Visa Change Request Received", notify: "VC_NEW", maps: "NEW", from: ["New", "Follow-up Required", "Customer Responded"] },
      { name: "Current Visa Review", customerLabel: "Current Visa Being Reviewed", notify: null, maps: "CONTACTED", from: ["Contacted", "Qualified"] },
      { name: "Quotation Sent", customerLabel: "Visa Change Quotation Ready", notify: "VC_QUOTATION_SENT", systemEvent: "QUOTATION_CREATED", maps: "QUOTATION_CREATED", from: ["Quotation Created"] },
      { name: "Quotation Approved", customerLabel: "Quotation Approved", notify: "VC_QUOTATION_APPROVED", systemEvent: "QUOTATION_ACCEPTED", maps: "QUOTATION_ACCEPTED", from: ["Quotation Accepted"] },
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: "VC_PAYMENT_PENDING", maps: "PAYMENT_PENDING", from: ["Payment Pending"] },
      leadPaid(),
      leadCancelled,
      leadHold,
    ],
  },
  {
    serviceType: "VISA_CHANGE",
    scope: "BOOKING",
    statuses: [
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: null, maps: "PENDING", from: ["Payment Pending", "Lead Created", "Availability Check", "Availability Confirmed", "Customer Notified", "Date/Time/Package Selected"] },
      { name: "Paid", customerLabel: "Payment Received", notify: "VC_PAID", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Payment Received", "Booking ID Generated"] },
      { name: "Documents Pending", customerLabel: "Documents Required", notify: "VC_DOCUMENTS_PENDING", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED", from: ["Documents Pending"] },
      { name: "Documents Required", customerLabel: "Documents Required", notify: "VC_DOCUMENTS_REQUIRED", systemEvent: "DOCUMENTS_REJECTED", maps: "CONFIRMED" },
      { name: "Documents Uploaded", customerLabel: "Documents Received", notify: null, systemEvent: "DOCUMENTS_RECEIVED", maps: "CONFIRMED", from: ["Documents Received"] },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: "VC_DOCUMENTS_VALIDATED", systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED", from: ["Documents Verified"] },
      { name: "Package Generated", customerLabel: "Visa Change Package Ready", notify: "VC_PACKAGE_GENERATED", systemEvent: "DELIVERED_PACKAGE_PDF", maps: "PROCESSING", from: ["Package Generated", "Exit Pending"] },
      { name: "Exit Completed", customerLabel: "Exit Completed", notify: "VC_EXIT_COMPLETED", systemEvent: "VC_EXIT_COMPLETED", maps: "PROCESSING", blocksRefund: true, from: ["Exit Completed"] },
      { name: "Ready for Submission", customerLabel: "Application Being Prepared", notify: null, systemEvent: "READY_FOR_SUBMISSION", maps: "PROCESSING", blocksRefund: true },
      { name: "Applied to Embassy", customerLabel: "Applied to Embassy", notify: "VC_APPLIED_TO_EMBASSY", systemEvent: "EMBASSY_APPLIED", maps: "PROCESSING", blocksRefund: true, from: ["New Visa Processing"] },
      { name: "Additional Documents Required", customerLabel: "Additional Documents Required", notify: "VC_ADDITIONAL_DOCUMENTS_REQUIRED", systemEvent: "EMBASSY_ADDITIONAL_DOCS", maps: "PROCESSING", blocksRefund: true, from: ["Additional Documents Required"] },
      { name: "Additional Documents Submitted", customerLabel: "Additional Documents Submitted", notify: "VC_ADDITIONAL_DOCUMENTS_SUBMITTED", systemEvent: "ADDITIONAL_DOCUMENTS_RECEIVED", maps: "PROCESSING", blocksRefund: true, from: ["Additional Documents Submitted"] },
      { name: "Additional Documents Validated", customerLabel: "Additional Documents Validated", notify: null, systemEvent: "ADDITIONAL_DOCUMENTS_VALIDATED", maps: "PROCESSING", blocksRefund: true, from: ["Additional Documents Validated"] },
      { name: "Visa Approved — Partial Applicants", customerLabel: "Visa Approved — Partial Applicants", notify: "VC_VISA_APPROVED_PARTIAL_APPLICANTS", systemEvent: "PARTIAL_APPROVED", maps: "PROCESSING", blocksRefund: true },
      { name: "Visa Approved", customerLabel: "Visa Approved", notify: "VC_VISA_APPROVED", systemEvent: "DELIVERED_VISA_PDF", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["Visa Approved", "Visa Delivered", "Completed"] },
      { name: "Visa Rejected", customerLabel: "Visa Application Rejected", notify: "VC_VISA_REJECTED", systemEvent: "EMBASSY_REJECTED", maps: "CANCELLED", terminal: true, blocksRefund: true, from: ["Visa Rejected"] },
      { name: "On Hold", customerLabel: "Booking On Hold", notify: "VC_ON_HOLD", systemEvent: HOLD, from: ["On Hold"] },
      ...refundTail("VC", {}),
      { name: "Cancelled", customerLabel: "Cancelled", notify: "VC_CANCELLED", systemEvent: "CANCELLED", maps: "CANCELLED" },
      { name: "Refund Pending", customerLabel: "Refund Processing", notify: null, systemEvent: "REFUND_RAISED" },
      { name: "Refund Completed", customerLabel: "Refund Completed", notify: "VC_REFUND_COMPLETED", systemEvent: "REFUND_COMPLETED" },
      { name: "Cancelled and Refunded", customerLabel: "Booking Cancelled — Refund Completed", notify: null, systemEvent: "CANCELLED_AND_REFUNDED", maps: "REFUNDED", terminal: true },
    ],
  },

  // ───────────────────────────── Visa Extension ─────────────────────────────
  {
    serviceType: "VISA_EXTENSION",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "New Extension Request", notify: "EXT_01", maps: "NEW", from: ["New", "Follow-up Required", "Customer Responded"] },
      { name: "Eligibility Review", customerLabel: "Eligibility Under Review", notify: null, maps: "CONTACTED", from: ["Contacted", "Qualified"] },
      { name: "Not Eligible", customerLabel: "Not Eligible for Extension", notify: "EXT_03", maps: "LOST", terminal: true },
      { name: "Quotation Sent", customerLabel: "Quotation Sent", notify: "EXT_04", systemEvent: "QUOTATION_CREATED", maps: "QUOTATION_CREATED", from: ["Quotation Created"] },
      { name: "Quotation Approved", customerLabel: "Quotation Approved", notify: "EXT_05", systemEvent: "QUOTATION_ACCEPTED", maps: "QUOTATION_ACCEPTED", from: ["Quotation Accepted"] },
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: "EXT_06", maps: "PAYMENT_PENDING", from: ["Payment Pending"] },
      leadPaid(),
      { ...leadCancelled, from: ["Lost", "Closed"] },
      leadHold,
    ],
  },
  {
    serviceType: "VISA_EXTENSION",
    scope: "BOOKING",
    statuses: [
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: null, maps: "PENDING", from: ["Payment Pending", "Extension Lead Created", "Under Staff Review", "Visa Verification Required", "Eligibility Review", "Vendor/Sponsor Selected", "Quotation Ready"] },
      { name: "Paid", customerLabel: "Payment Received", notify: "EXT_07", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Payment Received", "Documents Validated"] },
      { name: "Ready for Submission", customerLabel: "Ready for Submission", notify: null, systemEvent: "READY_FOR_SUBMISSION", maps: "CONFIRMED" },
      { name: "Applied to Embassy", customerLabel: "Applied to Embassy", notify: "EXT_09", systemEvent: "EMBASSY_APPLIED", maps: "PROCESSING", blocksRefund: true, from: ["Processing", "Re-processing"] },
      { name: "Not Accepted", customerLabel: "Not Accepted", notify: "EXT_10", systemEvent: "EXTENSION_NOT_ACCEPTED", maps: "CANCELLED", terminal: true, from: ["Not Accepted"] },
      { name: "Additional Documents Required", customerLabel: "Additional Documents Required", notify: "EXT_11", systemEvent: "EMBASSY_ADDITIONAL_DOCS", maps: "PROCESSING", blocksRefund: true, from: ["Additional Information Required"] },
      { name: "Additional Documents Submitted", customerLabel: "Additional Documents Received", notify: "EXT_12", systemEvent: "ADDITIONAL_DOCUMENTS_RECEIVED", maps: "PROCESSING", blocksRefund: true },
      { name: "Additional Documents Validated", customerLabel: "Additional Documents Validated", notify: "EXT_13", systemEvent: "ADDITIONAL_DOCUMENTS_VALIDATED", maps: "PROCESSING", blocksRefund: true },
      { name: "Visa Approved — Partial Applicants", customerLabel: "Visa Approved — Partial Applicants", notify: "EXT_14", systemEvent: "PARTIAL_APPROVED", maps: "PROCESSING", blocksRefund: true },
      { name: "Visa Approved", customerLabel: "Visa Approved", notify: "EXT_15", systemEvent: "EXTENSION_EXTENDED", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["Extended", "Visa Delivered", "Completed"] },
      { name: "Visa Rejected", customerLabel: "Visa Rejected", notify: "EXT_16", systemEvent: "EXTENSION_REJECTED", maps: "CANCELLED", terminal: true, blocksRefund: true, from: ["Rejected", "Not Eligible"] },
      { name: "On Hold", customerLabel: "Booking On Hold", notify: "EXT_17", systemEvent: HOLD, from: ["On Hold"] },
      ...refundTail("EXT", { requested: "EXT_18", requestedLabel: "Cancellation Requested", partial: "EXT_19" }),
      { name: "Cancelled", customerLabel: "Cancelled", notify: "EXT_20", systemEvent: "CANCELLED", maps: "CANCELLED", from: ["Cancelled"] },
      { name: "Refund Pending", customerLabel: "Refund Pending", notify: "EXT_21", systemEvent: "REFUND_RAISED", from: ["Refund Processing"] },
      { name: "Refund Completed", customerLabel: "Refund Completed", notify: "EXT_22", systemEvent: "REFUND_COMPLETED", from: ["Refund Completed"] },
      { name: "Cancelled and Refunded", customerLabel: "Booking Cancelled — Refund Completed", notify: null, systemEvent: "CANCELLED_AND_REFUNDED", maps: "REFUNDED", terminal: true },
    ],
  },

  // ───────────────────────────── OTB ─────────────────────────────
  {
    serviceType: "OTB",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "New Request Received", notify: "OTB_01_NEW", maps: "NEW", from: ["New", "Contacted", "Follow-up Required", "Customer Responded", "Qualified", "Quotation Created", "Quotation Accepted", "Payment Pending"] },
      leadPaid(),
      leadCancelled,
      leadHold,
    ],
  },
  {
    serviceType: "OTB",
    scope: "BOOKING",
    statuses: [
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: null, maps: "PENDING", from: ["Payment Pending", "OTB Upsell Offered", "OTB Application Started"] },
      { name: "Paid", customerLabel: "Payment Received", notify: "OTB_02_PAYMENT_SUCCESSFUL", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Payment Successful", "OTB Booking Generated", "Staff Verification Pending"] },
      { name: "Document Pending", customerLabel: "Documents Required", notify: "OTB_03_DOCUMENT_REQUIRED", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED", from: ["Documents Required"] },
      { name: "Documents Uploaded", customerLabel: "Documents Received", notify: "OTB_04_DOCUMENTS_RECEIVED", systemEvent: "DOCUMENTS_RECEIVED", maps: "CONFIRMED", from: ["Document Validation Pending"] },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: "OTB_05_DOCUMENTS_VALIDATED", systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED", from: ["Documents Validated", "Ready for Submission"] },
      { name: "Sent to Airlines", customerLabel: "Sent to Airlines", notify: "OTB_06_SENT_TO_AIRLINES", systemEvent: "OTB_SUBMITTED", maps: "PROCESSING", blocksRefund: true, from: ["Submitted to Airline", "Airline Processing", "Additional Documents Required"] },
      { name: "Additional Documents Received", customerLabel: "Additional Documents Received", notify: "OTB_07_ADDITIONAL_DOCUMENTS_RECEIVED", systemEvent: "ADDITIONAL_DOCUMENTS_RECEIVED", maps: "PROCESSING", blocksRefund: true },
      { name: "Additional Documents Validated", customerLabel: "Additional Documents Validated", notify: "OTB_08_ADDITIONAL_DOCUMENTS_VALIDATED", systemEvent: "ADDITIONAL_DOCUMENTS_VALIDATED", maps: "PROCESSING", blocksRefund: true, from: ["Additional Documents Validated"] },
      { name: "Additional Documents Submitted", customerLabel: "Additional Documents Submitted", notify: "OTB_09_ADDITIONAL_DOCUMENTS_SUBMITTED", systemEvent: "OTB_ADDITIONAL_DOCUMENTS", maps: "PROCESSING", blocksRefund: true, from: ["Additional Documents Submitted"] },
      { name: "OTB Application Approved", customerLabel: "OTB Approved", notify: "OTB_10_OTB_APPROVED", systemEvent: "OTB_APPROVED", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["OTB Approved"] },
      { name: "OTB Approved for Partially Applicants", customerLabel: "OTB Approved for Partially Applicants", notify: "OTB_11_PARTIALLY_APPROVED", systemEvent: "PARTIAL_APPROVED", maps: "PROCESSING", blocksRefund: true },
      { name: "OTB Application Rejected", customerLabel: "OTB Rejected", notify: "OTB_12_REJECTED", systemEvent: "OTB_REJECTED", maps: "CANCELLED", terminal: true, blocksRefund: true, from: ["OTB Rejected"] },
      { name: "Partially Cancellation Requested", customerLabel: "Partial Cancellation Under Review", notify: "OTB_13_PARTIALLY_CANCELLATION_REQUESTED" },
      { name: "Partially Cancelled", customerLabel: "Partially Cancelled", notify: "OTB_14_PARTIALLY_CANCELLED", systemEvent: "REFUND_PARTIALLY_COMPLETED" },
      { name: "Cancellation Requested", customerLabel: "Cancellation Under Review", notify: "OTB_15_CANCELLATION_REQUESTED" },
      { name: "Cancelled", customerLabel: "Cancelled", notify: "OTB_16_CANCELLED", systemEvent: "CANCELLED", maps: "CANCELLED", from: ["Cancelled", "Unable to Process", "OTB Not Required"] },
      { name: "Refund Pending", customerLabel: "Refund Processing", notify: "OTB_17_REFUND_PENDING", systemEvent: "REFUND_RAISED", from: ["Refund Processing"] },
      { name: "Refund Completed", customerLabel: "Refund Completed", notify: "OTB_18_REFUND_COMPLETED", systemEvent: "REFUND_COMPLETED", from: ["Refund Completed"] },
      { name: "Cancelled and Refunded", customerLabel: "Booking Cancelled — Refund Completed", notify: null, systemEvent: "CANCELLED_AND_REFUNDED", maps: "REFUNDED", terminal: true },
      { name: "On Hold", customerLabel: "Booking On Hold", notify: null, systemEvent: HOLD, from: ["On Hold"] },
    ],
  },

  // ───────────────────────────── Return Verified Ticket ─────────────────────────────
  {
    serviceType: "RETURN_TICKET",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "New Request Received", notify: "RVT_NEW", maps: "NEW", from: ["New", "Contacted", "Follow-up Required", "Customer Responded", "Qualified", "Quotation Created", "Quotation Accepted", "Payment Pending"] },
      leadPaid(),
      leadCancelled,
      leadHold,
    ],
  },
  {
    serviceType: "RETURN_TICKET",
    scope: "BOOKING",
    statuses: [
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: null, maps: "PENDING", from: ["Payment Pending", "Return Ticket Upsell Offered", "Application Started"] },
      { name: "Paid", customerLabel: "Payment Received", notify: "RVT_PAID", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Payment Successful", "Booking Generated"] },
      { name: "Document Pending", customerLabel: "Documents Required", notify: "RVT_DOCUMENT_PENDING", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED", from: ["Documents Required"] },
      { name: "Document Required", customerLabel: "Documents Required", notify: "RVT_DOCUMENT_REQUIRED", systemEvent: "DOCUMENTS_REJECTED", maps: "CONFIRMED" },
      { name: "Documents Uploaded", customerLabel: "Documents Received", notify: "RVT_DOCUMENTS_UPLOADED", systemEvent: "DOCUMENTS_RECEIVED", maps: "CONFIRMED", from: ["Document Validation Pending"] },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: "RVT_DOCUMENTS_VALIDATED", systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED", from: ["Documents Validated"] },
      { name: "Unable to Process", customerLabel: "Unable to Process", notify: "RVT_UNABLE_TO_PROCESS", maps: "CANCELLED", terminal: true, from: ["Unable to Process", "Expired Reservation"] },
      { name: "Sent to Airlines", customerLabel: "Sent to Airlines", notify: "RVT_SENT_TO_AIRLINES", systemEvent: "SENT_TO_AIRLINES", maps: "PROCESSING", blocksRefund: true, from: ["Forwarded to Airline / Vendor", "Ticket / Reservation Processing", "Vendor Issue"] },
      { name: "Ticket Issued", customerLabel: "Ticket Issued", notify: "RVT_TICKET_ISSUED", systemEvent: "DELIVERED_RESERVATION_PDF", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["Ticket Issued", "Delivered", "Completed"] },
      ...refundTail("RVT", {}),
      { name: "Cancelled", customerLabel: "Cancelled", notify: "RVT_CANCELLED", systemEvent: "CANCELLED", maps: "CANCELLED", from: ["Customer Cancellation"] },
      { name: "Refund Pending", customerLabel: "Refund Processing", notify: "RVT_REFUND_PENDING", systemEvent: "REFUND_RAISED", from: ["Refund Processing"] },
      { name: "Refund Completed", customerLabel: "Refund Completed", notify: "RVT_REFUND_COMPLETED", systemEvent: "REFUND_COMPLETED", from: ["Refund Completed"] },
      { name: "Cancelled and Refunded", customerLabel: "Booking Cancelled — Refund Completed", notify: null, systemEvent: "CANCELLED_AND_REFUNDED", maps: "REFUNDED", terminal: true },
      { name: "On Hold", customerLabel: "Booking On Hold", notify: null, systemEvent: HOLD, from: ["On Hold"] },
    ],
  },

  // ───────────────────────────── Flight Special Fare ─────────────────────────────
  {
    serviceType: "FLIGHT_SPECIAL_FARE",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "Request Received", notify: "SF_01", maps: "NEW", from: ["New", "Contacted", "Follow-up Required", "Customer Responded", "Qualified"] },
      { name: "Quotation Sent", customerLabel: "Special Fare Quotation Ready", notify: "SF_02", systemEvent: "QUOTATION_CREATED", maps: "QUOTATION_CREATED", from: ["Quotation Created"] },
      { name: "Expiring", customerLabel: "Quotation Expiring Soon", notify: null, systemEvent: "QUOTE_EXPIRING", maps: "QUOTATION_CREATED" },
      { name: "Expired", customerLabel: "Quotation Expired", notify: "SF_05", systemEvent: "QUOTE_EXPIRED", maps: "QUOTATION_CREATED" },
      { name: "New Quote Requested", customerLabel: "New Quotation Request Received", notify: "SF_06", systemEvent: "NEW_QUOTE_REQUESTED", maps: "QUALIFIED" },
      { name: "Quotation Approved", customerLabel: "Quotation Approved", notify: "SF_03", systemEvent: "QUOTATION_ACCEPTED", maps: "QUOTATION_ACCEPTED", from: ["Quotation Accepted"] },
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: "SF_07", maps: "PAYMENT_PENDING", from: ["Payment Pending"] },
      leadPaid(),
      leadCancelled,
      leadHold,
    ],
  },
  {
    serviceType: "FLIGHT_SPECIAL_FARE",
    scope: "BOOKING",
    statuses: [
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: null, maps: "PENDING", from: ["Payment Pending", "New", "Availability Pending", "Quote Sent", "Quote Viewed", "Expiring", "New Quote Requested", "Follow-up Due", "Expired"] },
      { name: "Paid", customerLabel: "Payment Received", notify: "SF_08", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Paid"] },
      { name: "Final Confirmation", customerLabel: "Check Final Availability", notify: "SF_09", systemEvent: "FSF_FINAL_CONFIRMATION", maps: "CONFIRMED", from: ["Final Confirmation"] },
      { name: "Documents Pending", customerLabel: "Documents Required", notify: "SF_10", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED" },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: "SF_11", systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED", from: ["Documents Validated"] },
      { name: "Seat Unavailable", customerLabel: "Requested Flight Unavailable", notify: "SF_27", systemEvent: "FSF_SEAT_UNAVAILABLE", maps: "CONFIRMED" },
      { name: "Alternative Offered", customerLabel: "Alternative Flight Offered", notify: "SF_13", systemEvent: "FSF_ALTERNATIVE_OFFERED", maps: "CONFIRMED", from: ["Alternative Offered"] },
      { name: "Additional Payment Pending", customerLabel: "Additional Payment Required", notify: "SF_14", systemEvent: "FSF_ADDITIONAL_PAYMENT_PENDING", maps: "CONFIRMED", from: ["Additional Payment Pending"] },
      { name: "Sent to Airlines", customerLabel: "Sent to Airlines", notify: "SF_12", systemEvent: "FSF_AVAILABILITY_CONFIRMED", maps: "PROCESSING", from: ["Sent to Airlines", "PNR Recorded"] },
      { name: "Ticket Issued", customerLabel: "Ticket Issued", notify: "SF_15", systemEvent: "DELIVERED_TICKET_PDF", maps: "COMPLETED", terminal: true, from: ["Ticket Issued"] },
      { name: "On Hold", customerLabel: "Booking On Hold", notify: "SF_16", systemEvent: HOLD, from: ["On Hold", "Booking On Hold"] },
      { name: "Cancellation Requested", customerLabel: "Cancellation Under Review", notify: "SF_28" },
      { name: "Ticket Cancellation Requested", customerLabel: "Cancellation Request Received", notify: "SF_17" },
      { name: "Sent to Airlines for Cancellation", customerLabel: "Cancellation Sent to Airline", notify: "SF_18" },
      { name: "Cancellation Quotation Sent", customerLabel: "Cancellation Charges & Refund Quote Ready", notify: "SF_19" },
      { name: "Cancellation Quotation Approved", customerLabel: "Cancellation Quotation Approved", notify: "SF_20" },
      { name: "Cancellation Rejected", customerLabel: "Cancellation Request Rejected", notify: "SF_21" },
      { name: "Ticket Cancelled", customerLabel: "Ticket Cancelled", notify: "SF_22", systemEvent: "CANCELLED", maps: "CANCELLED", from: ["Cancelled"] },
      { name: "Refund Pending", customerLabel: "Refund Pending", notify: "SF_23", systemEvent: "REFUND_RAISED", from: ["Refund Pending"] },
      { name: "Refund Processing", customerLabel: "Refund Processing", notify: "SF_24", systemEvent: "REFUND_APPROVED" },
      { name: "Refund Completed", customerLabel: "Refund Completed", notify: "SF_25", systemEvent: "REFUND_COMPLETED" },
      { name: "Cancelled and Refunded", customerLabel: "Booking Cancelled — Refund Completed", notify: null, systemEvent: "CANCELLED_AND_REFUNDED", maps: "REFUNDED", terminal: true },
    ],
  },
];

/** Template events sent outside a status change (reminders), so the catalog test knows they're expected. */
export const STANDALONE_TEMPLATE_EVENTS = ["SF_04", "OTB_19_CANCELLED_AND_REFUNDED", "SF_29", "EXT_02", "EXT_08", "EXT_23"] as const;
