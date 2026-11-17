import type { BookingStatus, LeadStatus, ServiceType, StatusScope } from "../../generated/prisma/enums";

/**
 * Each service's final status list (internal CRM status, what the customer sees, and whether a message goes out),
 * exactly as the client handed it over — client doc 2026-10-20, revised by client doc 16 Nov 2026 ("Service Status &
 * Developer Handover" §1–§8). It is loaded into ServiceStatus by migrations generated from this file by
 * `scripts/status-catalog-sql.ts` (20261021090000_client_status_lists, 20261116140000_client_status_lists_16nov) and
 * stays Admin-editable afterwards; the tests check this file against the template catalog so every status that
 * notifies has its email + WhatsApp template.
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
/** Client doc 16 Nov — the one common "User Not Responding" status: staff set it by hand before the hand-over; any customer action moves the record on. */
const NOT_RESPONDING = "NOT_RESPONDING";
/** Client doc 16 Nov rule 6 — one common template for "User Not Responding" in every service. */
const UNR_TEMPLATE = "USER_NOT_RESPONDING";

/**
 * Client doc 16 Nov (J1) — the lead section's own statuses: New, User Not Responding (the only one that messages the
 * customer), Contacted, Interested, Under Review, Unqualified, and Converted (set by the payment itself). Lead "On Hold"
 * and "Cancelled" are gone (a dropped lead is Unqualified); the quotation services keep their quotation steps (§S).
 */
const leadConverted: CatalogStatus = {
  name: "Converted",
  customerLabel: "Payment Received",
  notify: null,
  systemEvent: "PAYMENT_SUCCESS",
  maps: "CONVERTED",
  terminal: true,
  from: ["Paid", "Converted"],
};
const leadUnqualified: CatalogStatus = { name: "Unqualified", customerLabel: "Closed", notify: null, maps: "LOST", terminal: true, from: ["Cancelled", "Lost", "Closed"] };
const leadContacted: CatalogStatus = { name: "Contacted", customerLabel: "Request Received", notify: null, maps: "CONTACTED", from: ["Contacted", "On Hold"] };
const leadInterested: CatalogStatus = { name: "Interested", customerLabel: "Request Received", notify: null, maps: "CUSTOMER_RESPONDED", from: ["Customer Responded"] };
const leadUnderReview: CatalogStatus = { name: "Under Review", customerLabel: "Request Under Review", notify: null, maps: "QUALIFIED", from: ["Qualified"] };
/** The sales statuses every lead list starts with (after New / User Not Responding). */
const leadSales = (withReview: boolean): CatalogStatus[] => (withReview ? [leadContacted, leadInterested, leadUnderReview] : [leadContacted, leadInterested]);
const leadNotResponding: CatalogStatus = {
  name: "User Not Responding",
  customerLabel: "User Not Responding",
  notify: UNR_TEMPLATE,
  systemEvent: NOT_RESPONDING,
  maps: "FOLLOW_UP_REQUIRED",
  from: ["Follow-up Required"],
};
const bookingNotResponding: CatalogStatus = { name: "User Not Responding", customerLabel: "User Not Responding", notify: UNR_TEMPLATE, systemEvent: NOT_RESPONDING, maps: "CONFIRMED" };
/** Client doc 16 Nov rule 7 — one common "Booking On Hold", placed before the hand-over (Applied to Embassy / Sent to Airlines). */
const bookingHold = (notify: string | null): CatalogStatus => ({ name: "Booking On Hold", customerLabel: "Booking On Hold", notify, systemEvent: HOLD, from: ["On Hold", "Booking On Hold"] });

/**
 * Client doc 16 Nov (§1 rules 12–14, §8) — the shared cancellation tail. Staff start it only with Initiate Refund
 * (the raised refund moves the booking to "Cancellation Requested"); the approved refund then sets "Partially
 * Cancelled" (some passengers) or "Cancelled" (everything paid). The old Refund Pending / Processing / Completed and
 * "Cancelled and Refunded" steps are folded into these.
 */
function cancellationTail(notify: { requested: string; partial: string; cancelled: string }): CatalogStatus[] {
  return [
    { name: "Cancellation Requested", customerLabel: "Cancellation Under Review", notify: notify.requested, systemEvent: "REFUND_RAISED", from: ["Cancellation Requested", "Refund Pending", "Refund Processing"] },
    { name: "Partially Cancelled", customerLabel: "Partially Cancelled", notify: notify.partial, systemEvent: "REFUND_PARTIALLY_COMPLETED" },
    {
      name: "Cancelled",
      customerLabel: "Cancelled",
      notify: notify.cancelled,
      systemEvent: "REFUND_COMPLETED",
      maps: "REFUNDED",
      terminal: true,
      from: ["Cancelled", "Cancelled and Refunded", "Refund Completed"],
    },
  ];
}

/** Client doc 16 Nov rule 8 — "Quotation Sent" shows "Quotation Ready" in every quotation service; the customer's yes is "Quotation Accepted". */
const quotationSent = (notify: string): CatalogStatus => ({
  name: "Quotation Sent",
  customerLabel: "Quotation Ready",
  notify,
  systemEvent: "QUOTATION_CREATED",
  maps: "QUOTATION_CREATED",
  from: ["Quotation Created"],
});
const quotationAccepted = (notify: string): CatalogStatus => ({
  name: "Quotation Accepted",
  customerLabel: "Quotation Accepted",
  notify,
  systemEvent: "QUOTATION_ACCEPTED",
  maps: "QUOTATION_ACCEPTED",
  from: ["Quotation Approved", "Quotation Accepted"],
});

/** The visa services' additional-documents steps (client doc 16 Nov §2 — Visa is the master list the others reuse). */
const visaAdditionalDocs = (notify: { required: string; submitted: string | null; validated: string | null }): CatalogStatus[] => [
  {
    name: "Additional Documents Required",
    customerLabel: "Additional Documents Required",
    notify: notify.required,
    systemEvent: "EMBASSY_ADDITIONAL_DOCS",
    maps: "PROCESSING",
    blocksRefund: true,
    from: ["Additional Document Requested", "Customer Upload Pending", "Additional Information Required"],
  },
  { name: "Additional Documents Submitted", customerLabel: "Additional Documents Received", notify: notify.submitted, systemEvent: "ADDITIONAL_DOCUMENTS_RECEIVED", maps: "PROCESSING", blocksRefund: true, from: ["Re-submitted"] },
  { name: "Additional Documents Validated", customerLabel: "Additional Documents Validated", notify: notify.validated, systemEvent: "ADDITIONAL_DOCUMENTS_VALIDATED", maps: "PROCESSING", blocksRefund: true, from: ["Re-validation"] },
];

export const STATUS_CATALOG: CatalogList[] = [
  // ───────────────────────────── New Visa ─────────────────────────────
  {
    serviceType: "NEW_VISA",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "Payment Pending", notify: "NV_COUNTRY_REQUEST_PAYMENT_PENDING", maps: "NEW", from: ["New", "Quotation Created", "Quotation Accepted", "Payment Pending"] },
      leadNotResponding,
      ...leadSales(true),
      leadConverted,
      leadUnqualified,
    ],
  },
  {
    serviceType: "NEW_VISA",
    scope: "BOOKING",
    statuses: [
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: null, maps: "PENDING", from: ["Payment Pending", "Draft"] },
      { name: "Paid", customerLabel: "Payment Received", notify: "NV_PAYMENT_RECEIVED", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Payment Received"] },
      bookingNotResponding,
      // Client doc 16 Nov — one "Documents Required" step for missing, not uploaded or rejected documents.
      { name: "Documents Pending", customerLabel: "Documents Required", notify: "NV_DOCUMENTS_PENDING", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED", from: ["Documents Pending", "Documents Required"] },
      { name: "Documents Uploaded", customerLabel: "Documents Received", notify: null, systemEvent: "DOCUMENTS_RECEIVED", maps: "CONFIRMED", from: ["Documents Received", "OCR / Validation", "Staff Verification"] },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: "NV_DOCUMENTS_VALIDATED", systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED" },
      { name: "Ready for Submission", customerLabel: "Application Being Prepared", notify: null, systemEvent: "READY_FOR_SUBMISSION", maps: "CONFIRMED", from: ["Ready for Submission"] },
      bookingHold("NV_ON_HOLD"),
      { name: "Applied to Embassy", customerLabel: "Applied to Embassy", notify: "NV_APPLIED_TO_EMBASSY", systemEvent: "EMBASSY_APPLIED", maps: "PROCESSING", blocksRefund: true, from: ["Submitted to Embassy", "Embassy Reviewing"] },
      ...visaAdditionalDocs({ required: "NV_ADDITIONAL_DOCUMENTS_REQUIRED", submitted: null, validated: null }),
      { name: "Visa Approved for Partial Applicants", customerLabel: "Visa Approved for Partial Applicants", notify: "NV_PARTIAL_APPROVAL", systemEvent: "PARTIAL_APPROVED", maps: "PROCESSING", blocksRefund: true },
      { name: "Visa Application Approved", customerLabel: "Visa Application Approved", notify: "NV_VISA_APPROVED", systemEvent: "DELIVERED_VISA_PDF", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["Approved", "Visa PDF Delivered", "Completed"] },
      { name: "Visa Application Rejected", customerLabel: "Visa Application Rejected", notify: "NV_VISA_REJECTED", systemEvent: "EMBASSY_REJECTED", maps: "CANCELLED", terminal: true, blocksRefund: true, from: ["Rejected"] },
      ...cancellationTail({ requested: "NV_CANCELLATION_REQUESTED", partial: "NV_PARTIAL_CANCELLATION", cancelled: "NV_CANCELLED" }),
    ],
  },

  // ───────────────────────────── Visa Change ─────────────────────────────
  {
    serviceType: "VISA_CHANGE",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "Visa Change Request Received", notify: "VC_NEW", maps: "NEW", from: ["New"] },
      leadNotResponding,
      ...leadSales(false),
      { name: "Current Visa Review", customerLabel: "Current Visa Being Reviewed", notify: null, maps: "QUALIFIED", from: ["Qualified"] },
      quotationSent("VC_QUOTATION_SENT"),
      quotationAccepted("VC_QUOTATION_APPROVED"),
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: "VC_PAYMENT_PENDING", maps: "PAYMENT_PENDING", from: ["Payment Pending"] },
      leadConverted,
      leadUnqualified,
    ],
  },
  {
    serviceType: "VISA_CHANGE",
    scope: "BOOKING",
    statuses: [
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: null, maps: "PENDING", from: ["Payment Pending", "Lead Created", "Availability Check", "Availability Confirmed", "Customer Notified", "Date/Time/Package Selected"] },
      { name: "Paid", customerLabel: "Payment Received", notify: "VC_PAID", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Payment Received", "Booking ID Generated"] },
      bookingNotResponding,
      { name: "Documents Pending", customerLabel: "Documents Required", notify: "VC_DOCUMENTS_PENDING", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED", from: ["Documents Pending", "Documents Required"] },
      { name: "Documents Uploaded", customerLabel: "Documents Received", notify: null, systemEvent: "DOCUMENTS_RECEIVED", maps: "CONFIRMED", from: ["Documents Received"] },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: "VC_DOCUMENTS_VALIDATED", systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED", from: ["Documents Verified"] },
      { name: "Package Generated", customerLabel: "Visa Change Package Ready", notify: "VC_PACKAGE_GENERATED", systemEvent: "DELIVERED_PACKAGE_PDF", maps: "PROCESSING", from: ["Package Generated", "Exit Pending"] },
      { name: "Exit Completed", customerLabel: "Exit Completed", notify: "VC_EXIT_COMPLETED", systemEvent: "VC_EXIT_COMPLETED", maps: "PROCESSING", blocksRefund: true, from: ["Exit Completed"] },
      { name: "Ready for Submission", customerLabel: "Application Being Prepared", notify: null, systemEvent: "READY_FOR_SUBMISSION", maps: "PROCESSING", blocksRefund: true },
      bookingHold("VC_ON_HOLD"),
      { name: "Applied to Embassy", customerLabel: "Applied to Embassy", notify: "VC_APPLIED_TO_EMBASSY", systemEvent: "EMBASSY_APPLIED", maps: "PROCESSING", blocksRefund: true, from: ["New Visa Processing"] },
      ...visaAdditionalDocs({ required: "VC_ADDITIONAL_DOCUMENTS_REQUIRED", submitted: null, validated: null }),
      {
        name: "Visa Approved for Partial Applicants",
        customerLabel: "Visa Approved for Partial Applicants",
        notify: "VC_VISA_APPROVED_PARTIAL_APPLICANTS",
        systemEvent: "PARTIAL_APPROVED",
        maps: "PROCESSING",
        blocksRefund: true,
        from: ["Visa Approved — Partial Applicants"],
      },
      { name: "Visa Application Approved", customerLabel: "Visa Application Approved", notify: "VC_VISA_APPROVED", systemEvent: "DELIVERED_VISA_PDF", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["Visa Approved", "Visa Delivered", "Completed"] },
      { name: "Visa Application Rejected", customerLabel: "Visa Application Rejected", notify: "VC_VISA_REJECTED", systemEvent: "EMBASSY_REJECTED", maps: "CANCELLED", terminal: true, blocksRefund: true, from: ["Visa Rejected"] },
      ...cancellationTail({ requested: "VC_CANCELLATION_REQUESTED", partial: "VC_PARTIALLY_CANCELLED", cancelled: "VC_CANCELLED" }),
    ],
  },

  // ───────────────────────────── Visa Extension ─────────────────────────────
  {
    serviceType: "VISA_EXTENSION",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "New Extension Request", notify: "EXT_01", maps: "NEW", from: ["New"] },
      leadNotResponding,
      ...leadSales(false),
      { name: "Eligibility Review", customerLabel: "Eligibility Under Review", notify: null, maps: "QUALIFIED", from: ["Qualified"] },
      { name: "Not Eligible", customerLabel: "Not Eligible for Extension", notify: "EXT_03", maps: "LOST", terminal: true },
      quotationSent("EXT_04"),
      quotationAccepted("EXT_05"),
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: "EXT_06", maps: "PAYMENT_PENDING", from: ["Payment Pending"] },
      leadConverted,
      leadUnqualified,
    ],
  },
  {
    serviceType: "VISA_EXTENSION",
    scope: "BOOKING",
    statuses: [
      {
        name: "Payment Pending",
        customerLabel: "Payment Pending",
        notify: null,
        maps: "PENDING",
        from: ["Payment Pending", "Extension Lead Created", "Under Staff Review", "Visa Verification Required", "Eligibility Review", "Vendor/Sponsor Selected", "Quotation Ready"],
      },
      { name: "Paid", customerLabel: "Payment Received", notify: "EXT_07", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Payment Received"] },
      bookingNotResponding,
      // Client doc 16 Nov §4 — Visa Extension now has the document steps too.
      { name: "Documents Pending", customerLabel: "Documents Required", notify: "EXT_DOCUMENTS_PENDING", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED" },
      { name: "Documents Uploaded", customerLabel: "Documents Received", notify: null, systemEvent: "DOCUMENTS_RECEIVED", maps: "CONFIRMED" },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: null, systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED" },
      { name: "Ready for Submission", customerLabel: "Ready for Submission", notify: null, systemEvent: "READY_FOR_SUBMISSION", maps: "CONFIRMED" },
      bookingHold("EXT_17"),
      { name: "Applied to Embassy", customerLabel: "Applied to Embassy", notify: "EXT_09", systemEvent: "EMBASSY_APPLIED", maps: "PROCESSING", blocksRefund: true, from: ["Processing", "Re-processing"] },
      { name: "Not Accepted", customerLabel: "Not Accepted", notify: "EXT_10", systemEvent: "EXTENSION_NOT_ACCEPTED", maps: "CANCELLED", terminal: true, from: ["Not Accepted"] },
      ...visaAdditionalDocs({ required: "EXT_11", submitted: "EXT_12", validated: "EXT_13" }),
      { name: "Visa Approved for Partial Applicants", customerLabel: "Visa Approved for Partial Applicants", notify: "EXT_14", systemEvent: "PARTIAL_APPROVED", maps: "PROCESSING", blocksRefund: true, from: ["Visa Approved — Partial Applicants"] },
      { name: "Visa Application Approved", customerLabel: "Visa Application Approved", notify: "EXT_15", systemEvent: "EXTENSION_EXTENDED", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["Visa Approved", "Extended", "Visa Delivered", "Completed"] },
      { name: "Visa Application Rejected", customerLabel: "Visa Application Rejected", notify: "EXT_16", systemEvent: "EXTENSION_REJECTED", maps: "CANCELLED", terminal: true, blocksRefund: true, from: ["Visa Rejected", "Rejected", "Not Eligible"] },
      ...cancellationTail({ requested: "EXT_18", partial: "EXT_19", cancelled: "EXT_20" }),
    ],
  },

  // ───────────────────────────── OTB ─────────────────────────────
  {
    serviceType: "OTB",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "New Request Received", notify: "OTB_01_NEW", maps: "NEW", from: ["New", "Quotation Created", "Quotation Accepted", "Payment Pending"] },
      leadNotResponding,
      ...leadSales(true),
      leadConverted,
      leadUnqualified,
    ],
  },
  {
    serviceType: "OTB",
    scope: "BOOKING",
    statuses: [
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: null, maps: "PENDING", from: ["Payment Pending", "OTB Upsell Offered", "OTB Application Started"] },
      { name: "Paid", customerLabel: "Payment Received", notify: "OTB_02_PAYMENT_SUCCESSFUL", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Payment Successful", "OTB Booking Generated", "Staff Verification Pending"] },
      bookingNotResponding,
      { name: "Document Pending", customerLabel: "Documents Required", notify: "OTB_03_DOCUMENT_REQUIRED", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED", from: ["Documents Required"] },
      { name: "Documents Uploaded", customerLabel: "Documents Received", notify: "OTB_04_DOCUMENTS_RECEIVED", systemEvent: "DOCUMENTS_RECEIVED", maps: "CONFIRMED", from: ["Document Validation Pending"] },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: "OTB_05_DOCUMENTS_VALIDATED", systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED", from: ["Documents Validated", "Ready for Submission"] },
      bookingHold(null),
      { name: "Sent to Airlines", customerLabel: "Sent to Airlines", notify: "OTB_06_SENT_TO_AIRLINES", systemEvent: "OTB_SUBMITTED", maps: "PROCESSING", blocksRefund: true, from: ["Submitted to Airline", "Airline Processing", "Additional Documents Required"] },
      { name: "Additional Documents Received", customerLabel: "Additional Documents Received", notify: "OTB_07_ADDITIONAL_DOCUMENTS_RECEIVED", systemEvent: "ADDITIONAL_DOCUMENTS_RECEIVED", maps: "PROCESSING", blocksRefund: true },
      { name: "Additional Documents Validated", customerLabel: "Additional Documents Validated", notify: "OTB_08_ADDITIONAL_DOCUMENTS_VALIDATED", systemEvent: "ADDITIONAL_DOCUMENTS_VALIDATED", maps: "PROCESSING", blocksRefund: true, from: ["Additional Documents Validated"] },
      { name: "Additional Documents Submitted", customerLabel: "Additional Documents Submitted", notify: "OTB_09_ADDITIONAL_DOCUMENTS_SUBMITTED", systemEvent: "OTB_ADDITIONAL_DOCUMENTS", maps: "PROCESSING", blocksRefund: true, from: ["Additional Documents Submitted"] },
      { name: "OTB Application Approved", customerLabel: "OTB Approved", notify: "OTB_10_OTB_APPROVED", systemEvent: "OTB_APPROVED", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["OTB Approved"] },
      { name: "OTB Approved for Partially Applicants", customerLabel: "OTB Approved for Partially Applicants", notify: "OTB_11_PARTIALLY_APPROVED", systemEvent: "PARTIAL_APPROVED", maps: "PROCESSING", blocksRefund: true },
      { name: "OTB Application Rejected", customerLabel: "OTB Rejected", notify: "OTB_12_REJECTED", systemEvent: "OTB_REJECTED", maps: "CANCELLED", terminal: true, blocksRefund: true, from: ["OTB Rejected"] },
      // Client doc 16 Nov §7 — OTB keeps its own "Partially Cancellation Requested" (selected passengers only).
      { name: "Partially Cancellation Requested", customerLabel: "Partial Cancellation Under Review", notify: "OTB_13_PARTIALLY_CANCELLATION_REQUESTED", systemEvent: "PARTIAL_REFUND_RAISED" },
      ...cancellationTail({ requested: "OTB_15_CANCELLATION_REQUESTED", partial: "OTB_14_PARTIALLY_CANCELLED", cancelled: "OTB_16_CANCELLED" }),
    ],
  },

  // ───────────────────────────── Return Verified Ticket ─────────────────────────────
  {
    serviceType: "RETURN_TICKET",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "New Request Received", notify: "RVT_NEW", maps: "NEW", from: ["New", "Quotation Created", "Quotation Accepted", "Payment Pending"] },
      leadNotResponding,
      ...leadSales(true),
      leadConverted,
      leadUnqualified,
    ],
  },
  {
    serviceType: "RETURN_TICKET",
    scope: "BOOKING",
    statuses: [
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: null, maps: "PENDING", from: ["Payment Pending", "Return Ticket Upsell Offered", "Application Started"] },
      { name: "Paid", customerLabel: "Payment Received", notify: "RVT_PAID", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Payment Successful", "Booking Generated"] },
      bookingNotResponding,
      { name: "Documents Pending", customerLabel: "Documents Required", notify: "RVT_DOCUMENT_PENDING", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED", from: ["Document Pending"] },
      { name: "Documents Required", customerLabel: "Documents Required", notify: "RVT_DOCUMENT_REQUIRED", systemEvent: "DOCUMENTS_REJECTED", maps: "CONFIRMED", from: ["Document Required"] },
      { name: "Documents Uploaded", customerLabel: "Documents Received", notify: "RVT_DOCUMENTS_UPLOADED", systemEvent: "DOCUMENTS_RECEIVED", maps: "CONFIRMED", from: ["Document Validation Pending"] },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: "RVT_DOCUMENTS_VALIDATED", systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED", from: ["Documents Validated"] },
      { name: "Unable to Process", customerLabel: "Unable to Process", notify: "RVT_UNABLE_TO_PROCESS", maps: "CANCELLED", terminal: true, from: ["Unable to Process", "Expired Reservation"] },
      bookingHold(null),
      { name: "Sent to Airlines", customerLabel: "Sent to Airlines", notify: "RVT_SENT_TO_AIRLINES", systemEvent: "SENT_TO_AIRLINES", maps: "PROCESSING", blocksRefund: true, from: ["Forwarded to Airline / Vendor", "Ticket / Reservation Processing", "Vendor Issue"] },
      { name: "Ticket Issued", customerLabel: "Ticket Issued", notify: "RVT_TICKET_ISSUED", systemEvent: "DELIVERED_RESERVATION_PDF", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["Ticket Issued", "Delivered", "Completed"] },
      ...cancellationTail({ requested: "RVT_CANCELLATION_REQUESTED", partial: "RVT_PARTIALLY_CANCELLED", cancelled: "RVT_CANCELLED" }),
    ],
  },

  // ───────────────────────────── Flight Special Fare ─────────────────────────────
  {
    serviceType: "FLIGHT_SPECIAL_FARE",
    scope: "LEAD",
    statuses: [
      { name: "New", customerLabel: "Request Received", notify: "SF_01", maps: "NEW", from: ["New"] },
      leadNotResponding,
      ...leadSales(true),
      quotationSent("SF_02"),
      { name: "Expiring", customerLabel: "Quotation Expiring Soon", notify: null, systemEvent: "QUOTE_EXPIRING", maps: "QUOTATION_CREATED" },
      { name: "Expired", customerLabel: "Quotation Expired", notify: "SF_05", systemEvent: "QUOTE_EXPIRED", maps: "QUOTATION_CREATED" },
      { name: "New Quote Requested", customerLabel: "New Quotation Request Received", notify: "SF_06", systemEvent: "NEW_QUOTE_REQUESTED", maps: "QUALIFIED" },
      quotationAccepted("SF_03"),
      { name: "Payment Pending", customerLabel: "Payment Pending", notify: "SF_07", maps: "PAYMENT_PENDING", from: ["Payment Pending"] },
      leadConverted,
      leadUnqualified,
    ],
  },
  {
    serviceType: "FLIGHT_SPECIAL_FARE",
    scope: "BOOKING",
    statuses: [
      {
        name: "Payment Pending",
        customerLabel: "Payment Pending",
        notify: null,
        maps: "PENDING",
        from: ["Payment Pending", "New", "Availability Pending", "Quote Sent", "Quote Viewed", "Expiring", "New Quote Requested", "Follow-up Due", "Expired"],
      },
      { name: "Paid", customerLabel: "Payment Received", notify: "SF_08", systemEvent: "PAYMENT_SUCCESS", maps: "CONFIRMED", from: ["Paid"] },
      bookingNotResponding,
      { name: "Final Confirmation", customerLabel: "Check Final Availability", notify: "SF_09", systemEvent: "FSF_FINAL_CONFIRMATION", maps: "CONFIRMED", from: ["Final Confirmation"] },
      { name: "Documents Pending", customerLabel: "Documents Required", notify: "SF_10", systemEvent: "DOCUMENTS_REQUESTED", maps: "CONFIRMED" },
      { name: "Documents Validated", customerLabel: "Documents Validated", notify: "SF_11", systemEvent: "DOCUMENTS_VALIDATED", maps: "CONFIRMED", from: ["Documents Validated"] },
      bookingHold("SF_16"),
      // The unavailable → alternative → extra payment branch stays before Sent to Airlines (the flow only moves forward).
      { name: "Seat Unavailable", customerLabel: "Requested Flight Unavailable", notify: "SF_27", systemEvent: "FSF_SEAT_UNAVAILABLE", maps: "CONFIRMED" },
      { name: "Alternative Offered", customerLabel: "Alternative Flight Offered", notify: "SF_13", systemEvent: "FSF_ALTERNATIVE_OFFERED", maps: "CONFIRMED", from: ["Alternative Offered"] },
      { name: "Additional Payment Pending", customerLabel: "Additional Payment Required", notify: "SF_14", systemEvent: "FSF_ADDITIONAL_PAYMENT_PENDING", maps: "CONFIRMED", from: ["Additional Payment Pending"] },
      // Client doc 16 Nov (H12 / A13) — once sent to the airline / issued, no direct refund: the ticket-cancellation steps.
      { name: "Sent to Airlines", customerLabel: "Sent to Airlines", notify: "SF_12", systemEvent: "FSF_AVAILABILITY_CONFIRMED", maps: "PROCESSING", blocksRefund: true, from: ["Sent to Airlines", "PNR Recorded"] },
      { name: "Ticket Issued", customerLabel: "Ticket Issued", notify: "SF_15", systemEvent: "DELIVERED_TICKET_PDF", maps: "COMPLETED", terminal: true, blocksRefund: true, from: ["Ticket Issued"] },
      // Client doc 16 Nov §5 — after the ticket is issued, the airline's ticket-cancellation steps (ending at Ticket Cancelled);
      // before it, the shared cancellation tail below.
      { name: "Ticket Cancellation Requested", customerLabel: "Cancellation Request Received", notify: "SF_17" },
      { name: "Sent to Airlines for Cancellation", customerLabel: "Cancellation Sent to Airline", notify: "SF_18" },
      { name: "Cancellation Quotation Sent", customerLabel: "Cancellation Charges & Refund Quote Ready", notify: "SF_19" },
      { name: "Cancellation Quotation Accepted", customerLabel: "Cancellation Quotation Accepted", notify: "SF_20", from: ["Cancellation Quotation Approved"] },
      { name: "Ticket Cancelled", customerLabel: "Ticket Cancelled", notify: "SF_22", maps: "CANCELLED", terminal: true },
      { name: "Cancelled by Airline", customerLabel: "Flight Cancelled by Airline", notify: "SF_CANCELLED_BY_AIRLINE" },
      { name: "Rescheduled by Airline", customerLabel: "Flight Rescheduled by Airline", notify: "SF_RESCHEDULED_BY_AIRLINE" },
      ...cancellationTail({ requested: "SF_28", partial: "SF_PARTIALLY_CANCELLED", cancelled: "SF_CANCELLED" }),
    ],
  },
];

/** Template events sent outside a status change (reminders), so the catalog test knows they're expected. */
export const STANDALONE_TEMPLATE_EVENTS = ["SF_04", "SF_29", "EXT_02", "EXT_08", "EXT_23"] as const;

/**
 * Client doc 16 Nov — templates of statuses taken off the lists (the refund steps folded into Cancellation Requested /
 * Partially Cancelled / Cancelled, the visa services' separate "Documents Required", internal-only additional-document
 * uploads, the per-service "User Not Responding" replaced by the common one). Migration 20261116140000 switches their
 * rows off; Admin still lists them under retired templates.
 */
export const RETIRED_STATUS_TEMPLATE_EVENTS = [
  "NV_DOCUMENTS_REQUIRED",
  "NV_ADDITIONAL_DOCUMENTS_SUBMITTED",
  "NV_REFUND_COMPLETED",
  "NV_USER_NOT_RESPONDING",
  "VC_DOCUMENTS_REQUIRED",
  "VC_ADDITIONAL_DOCUMENTS_SUBMITTED",
  "VC_REFUND_COMPLETED",
  "EXT_21",
  "EXT_22",
  "OTB_17_REFUND_PENDING",
  "OTB_18_REFUND_COMPLETED",
  "OTB_19_CANCELLED_AND_REFUNDED",
  "RVT_REFUND_PENDING",
  "RVT_REFUND_COMPLETED",
  "SF_21",
  "SF_23",
  "SF_24",
  "SF_25",
] as const;
