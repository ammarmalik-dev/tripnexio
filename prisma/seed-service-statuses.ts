/**
 * Step 19 Unit 1 (audit §3.9/§7.3) seed data — one ServiceStatus catalog
 * per service, transcribed from that service's own already-locked MD
 * (real client content, not invented SAMPLE data, per CLAUDE.md hard rule
 * #1): New_Visa.md §10, OTB.md §18, Visa_Change.md §25, Visa_Extension.md
 * §19, Return_Verified_Ticket.md §24, Flight_Special_Fare.md §23.
 *
 * All seeded at scope "BOOKING" — see the ServiceStatus model's own schema
 * comment for why the granular case-processing detail these lists
 * describe is booking-level work in this app's architecture.
 *
 * `mapsToBookingStatus` and `blocksRefund` are a PROPOSED DEFAULT reading
 * of each status against the existing coarse BookingStatus lifecycle and
 * the refund-engine cutoffs already established in src/lib/refunds/rules.ts
 * (Step 15) — same "review before relying on it" caveat as every other
 * proposed-default lifecycle in this schema. `customerLabel` carries the
 * customer-facing status wording from the client's 2026-09 per-service
 * Developer Handover documents ("CRM statuses stay as they are; the shorter
 * lists are what the customer sees"). It's filled only where an internal
 * status clearly corresponds to a customer-facing one — internal steps with
 * no customer-facing counterpart stay null, and Admin can adjust any mapping
 * at /admin/service-statuses. New Visa's "Submitted to Embassy" now reads
 * "Applied to Embassy" per the handover (CRM.md §14's older example wording
 * was "Application submitted for processing").
 *
 * Transitions are seeded as a straightforward "next status in the same
 * group, in the order given" chain, plus a handful of explicit named
 * branches called out below where a service's own MD describes one
 * (an approved/rejected split, an alternative-outcome list, an exception
 * group). This is a starting point for Admin to refine via the
 * /admin/service-statuses screen, not a claim of exhaustive coverage of
 * every real-world branch — the MDs describe these as prose flow
 * diagrams, not formal state machines.
 */
import type { ServiceType, BookingStatus, LeadStatus } from "../src/generated/prisma/enums";
import { HOLD_MARKER, type ServiceStatusSystemEvent } from "../src/lib/service-status/events";

export interface StatusSeed {
  name: string;
  group?: string;
  isTerminal?: boolean;
  blocksRefund?: boolean;
  customerLabel?: string;
  mapsToBookingStatus?: BookingStatus;
  mapsToLeadStatus?: LeadStatus;
  /** P08: the system event that moves a record to this status (or the On Hold marker). */
  systemEvent?: ServiceStatusSystemEvent | typeof HOLD_MARKER;
  /** Left out of the automatic "next in the same group" chain — its transitions are listed explicitly. */
  noAutoChain?: boolean;
}

export interface ServiceStatusSeedDef {
  serviceType: ServiceType;
  scope?: "LEAD" | "BOOKING";
  statuses: StatusSeed[];
  /** Extra transitions beyond the auto-generated "next in same group" chain, as [fromName, toName] pairs. */
  extraTransitions?: [string, string][];
}

/** P08: every service gets an "On Hold" status per scope, reachable from and returning to every non-terminal status. */
export const ON_HOLD_STATUS_NAME = "On Hold";

export const SERVICE_STATUS_SEED: ServiceStatusSeedDef[] = [
  {
    serviceType: "NEW_VISA",
    statuses: [
      { name: "Draft", mapsToBookingStatus: "PENDING" },
      { name: "Payment Pending", mapsToBookingStatus: "PENDING" },
      { name: "Payment Received", customerLabel: "Application Received", mapsToBookingStatus: "CONFIRMED", systemEvent: "PAYMENT_SUCCESS" },
      { name: "Documents Pending", customerLabel: "Documents Upload Pending", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_REQUESTED" },
      { name: "Documents Received", customerLabel: "Documents Uploaded", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_RECEIVED" },
      { name: "OCR / Validation", mapsToBookingStatus: "CONFIRMED" },
      { name: "Staff Verification", mapsToBookingStatus: "CONFIRMED" },
      { name: "Ready for Submission", customerLabel: "Documents Validated", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_VALIDATED" },
      {
        name: "Submitted to Embassy",
        customerLabel: "Applied to Embassy",
        mapsToBookingStatus: "PROCESSING",
        blocksRefund: true,
        systemEvent: "EMBASSY_APPLIED",
      },
      { name: "Embassy Reviewing", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Additional Document Requested", customerLabel: "Additional Documents Required", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "EMBASSY_ADDITIONAL_DOCS" },
      { name: "Customer Upload Pending", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Re-validation", customerLabel: "Additional Documents Validated", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Re-submitted", customerLabel: "Additional Documents Submitted", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "EMBASSY_RESUBMITTED" },
      { name: "Approved", customerLabel: "Visa Approved", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "EMBASSY_APPROVED" },
      { name: "Rejected", customerLabel: "Rejected", isTerminal: true, mapsToBookingStatus: "CANCELLED", blocksRefund: true, systemEvent: "EMBASSY_REJECTED" },
      { name: "Visa PDF Delivered", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "DELIVERED_VISA_PDF" },
      { name: "Completed", isTerminal: true, mapsToBookingStatus: "COMPLETED", blocksRefund: true },
    ],
    extraTransitions: [
      ["Embassy Reviewing", "Rejected"],
      ["Re-submitted", "Embassy Reviewing"],
      ["Re-submitted", "Approved"],
      ["Re-submitted", "Rejected"],
      // P11 — the embassy actions staff take straight from "applied".
      ["Submitted to Embassy", "Additional Document Requested"],
      ["Submitted to Embassy", "Approved"],
      ["Submitted to Embassy", "Rejected"],
      ["Embassy Reviewing", "Approved"],
      ["Additional Document Requested", "Re-submitted"],
      ["Customer Upload Pending", "Re-submitted"],
      ["Approved", "Visa PDF Delivered"],
    ],
  },
  {
    serviceType: "VISA_EXTENSION",
    statuses: [
      { name: "Extension Lead Created", customerLabel: "Extension Request Received", mapsToBookingStatus: "PENDING" },
      { name: "Under Staff Review", mapsToBookingStatus: "PENDING" },
      { name: "Visa Verification Required", mapsToBookingStatus: "PENDING" },
      { name: "Eligibility Review", mapsToBookingStatus: "PENDING" },
      { name: "Vendor/Sponsor Selected", mapsToBookingStatus: "CONFIRMED" },
      { name: "Quotation Ready", mapsToBookingStatus: "CONFIRMED" },
      { name: "Payment Pending", mapsToBookingStatus: "CONFIRMED" },
      { name: "Payment Received", mapsToBookingStatus: "CONFIRMED", systemEvent: "PAYMENT_SUCCESS" },
      // P08 — Visa Extension handover's customer-facing "Document Validated" step.
      { name: "Documents Validated", customerLabel: "Document Validated", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_VALIDATED" },
      { name: "Processing", customerLabel: "Applied to Embassy", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Additional Information Required", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Re-processing", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Extended", customerLabel: "Approved", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "EXTENSION_EXTENDED" },
      { name: "Visa Delivered", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "DELIVERED_EXTENDED_VISA_PDF" },
      { name: "Completed", isTerminal: true, mapsToBookingStatus: "COMPLETED", blocksRefund: true },
      // Alternative outcomes (Visa_Extension.md §19) — Not Accepted vs.
      // Rejected are the two-different-refund-treatment split already
      // built as Booking.extensionOutcome in Step 15.
      { name: "Not Eligible", group: "Alternative Outcomes", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Not Accepted", group: "Alternative Outcomes", isTerminal: true, mapsToBookingStatus: "CANCELLED", systemEvent: "EXTENSION_NOT_ACCEPTED" },
      { name: "Rejected", customerLabel: "Rejected", group: "Alternative Outcomes", isTerminal: true, mapsToBookingStatus: "CANCELLED", blocksRefund: true, systemEvent: "EXTENSION_REJECTED" },
      { name: "Cancelled", group: "Alternative Outcomes", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Refund Processing", group: "Alternative Outcomes", mapsToBookingStatus: "REFUNDED" },
      { name: "Refund Completed", group: "Alternative Outcomes", isTerminal: true, mapsToBookingStatus: "REFUNDED" },
    ],
    extraTransitions: [
      ["Processing", "Not Eligible"],
      ["Processing", "Not Accepted"],
      ["Processing", "Rejected"],
      // P13 — outcomes from any in-process step.
      ["Processing", "Extended"],
      ["Additional Information Required", "Not Accepted"],
      ["Additional Information Required", "Rejected"],
      ["Re-processing", "Not Accepted"],
      ["Re-processing", "Rejected"],
      ["Not Accepted", "Refund Processing"],
      ["Rejected", "Refund Processing"],
      ["Cancelled", "Refund Processing"],
    ],
  },
  {
    serviceType: "VISA_CHANGE",
    statuses: [
      { name: "Lead Created", customerLabel: "Visa Change Request Received", mapsToBookingStatus: "PENDING" },
      { name: "Availability Check", mapsToBookingStatus: "PENDING" },
      { name: "Availability Confirmed", mapsToBookingStatus: "PENDING" },
      { name: "Customer Notified", mapsToBookingStatus: "PENDING" },
      { name: "Date/Time/Package Selected", mapsToBookingStatus: "PENDING" },
      { name: "Payment Pending", mapsToBookingStatus: "PENDING" },
      { name: "Payment Received", mapsToBookingStatus: "CONFIRMED", systemEvent: "PAYMENT_SUCCESS" },
      { name: "Booking ID Generated", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Pending", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_REQUESTED" },
      { name: "Documents Received", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_RECEIVED" },
      { name: "Documents Verified", customerLabel: "Documents Validated", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_VALIDATED" },
      { name: "Package Generated", customerLabel: "Package Generated", mapsToBookingStatus: "PROCESSING", systemEvent: "DELIVERED_PACKAGE_PDF" },
      { name: "Exit Pending", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      // P14 — staff actions (Exit Completed, then the embassy steps shared with New Visa).
      { name: "Exit Completed", customerLabel: "Exit Completed", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "VC_EXIT_COMPLETED" },
      { name: "New Visa Processing", customerLabel: "New Visa Applied to Embassy", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "EMBASSY_APPLIED" },
      { name: "Additional Documents Required", customerLabel: "Additional Documents Required", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "EMBASSY_ADDITIONAL_DOCS" },
      // P08 — Visa Change Page Content V3 customer steps.
      { name: "Additional Documents Validated", customerLabel: "Additional Documents Validated", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Additional Documents Submitted", customerLabel: "Additional Documents Submitted", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Visa Approved", customerLabel: "Visa Approved", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "EMBASSY_APPROVED" },
      { name: "Visa Rejected", customerLabel: "Rejected", isTerminal: true, mapsToBookingStatus: "CANCELLED", blocksRefund: true, systemEvent: "EMBASSY_REJECTED" },
      { name: "Visa Delivered", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "DELIVERED_VISA_PDF" },
      { name: "Completed", isTerminal: true, mapsToBookingStatus: "COMPLETED", blocksRefund: true },
    ],
    extraTransitions: [
      ["New Visa Processing", "Visa Rejected"],
      // P14 — staff actions.
      ["Package Generated", "Exit Completed"],
      ["New Visa Processing", "Visa Approved"],
      ["Additional Documents Required", "Visa Approved"],
      ["Additional Documents Required", "Visa Rejected"],
      ["Additional Documents Submitted", "Visa Approved"],
      ["Additional Documents Submitted", "Visa Rejected"],
      ["Visa Approved", "Visa Delivered"],
    ],
  },
  {
    serviceType: "RETURN_TICKET",
    statuses: [
      { name: "Return Ticket Upsell Offered", mapsToBookingStatus: "PENDING" },
      { name: "Application Started", customerLabel: "Request Received", mapsToBookingStatus: "PENDING" },
      { name: "Payment Pending", mapsToBookingStatus: "PENDING" },
      { name: "Payment Successful", mapsToBookingStatus: "CONFIRMED", systemEvent: "PAYMENT_SUCCESS" },
      { name: "Booking Generated", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Required", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_REQUESTED" },
      { name: "Document Validation Pending", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_RECEIVED" },
      { name: "Documents Validated", customerLabel: "Documents Validated", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_VALIDATED" },
      {
        name: "Forwarded to Airline / Vendor",
        mapsToBookingStatus: "PROCESSING",
        blocksRefund: true,
      },
      { name: "Ticket / Reservation Processing", customerLabel: "Sent to Airlines", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Ticket Issued", customerLabel: "Ticket Issued", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "RT_RESERVATION_ISSUED" },
      { name: "Delivered", mapsToBookingStatus: "PROCESSING", blocksRefund: true, systemEvent: "DELIVERED_RESERVATION_PDF" },
      { name: "Completed", isTerminal: true, mapsToBookingStatus: "COMPLETED", blocksRefund: true, systemEvent: "RT_AUTO_COMPLETED" },
      // Exceptions (Return_Verified_Ticket.md §24)
      { name: "Customer Cancellation", group: "Exceptions", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Refund Processing", group: "Exceptions", mapsToBookingStatus: "REFUNDED" },
      { name: "Refund Completed", group: "Exceptions", isTerminal: true, mapsToBookingStatus: "REFUNDED" },
      { name: "Unable to Process", group: "Exceptions", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Vendor Issue", group: "Exceptions", mapsToBookingStatus: "PROCESSING" },
      { name: "Expired Reservation", group: "Exceptions", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
    ],
    extraTransitions: [
      ["Documents Validated", "Customer Cancellation"],
      ["Customer Cancellation", "Refund Processing"],
      ["Ticket / Reservation Processing", "Vendor Issue"],
    ],
  },
  {
    serviceType: "OTB",
    statuses: [
      // Booking
      { name: "OTB Upsell Offered", group: "Booking", mapsToBookingStatus: "PENDING" },
      { name: "OTB Application Started", customerLabel: "OTB Application Received", group: "Booking", mapsToBookingStatus: "PENDING" },
      { name: "Payment Pending", group: "Booking", mapsToBookingStatus: "PENDING" },
      { name: "Payment Successful", group: "Booking", mapsToBookingStatus: "CONFIRMED", systemEvent: "PAYMENT_SUCCESS" },
      { name: "OTB Booking Generated", group: "Booking", mapsToBookingStatus: "CONFIRMED" },
      // Verification
      { name: "Staff Verification Pending", group: "Verification", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Required", customerLabel: "Documents Upload Pending", group: "Verification", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_REQUESTED" },
      { name: "Document Validation Pending", group: "Verification", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_RECEIVED" },
      { name: "Documents Validated", customerLabel: "Documents Validated", group: "Verification", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_VALIDATED" },
      // Airline
      { name: "Ready for Submission", group: "Airline", mapsToBookingStatus: "CONFIRMED" },
      { name: "Submitted to Airline", customerLabel: "Sent to Airlines", group: "Airline", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Airline Processing", group: "Airline", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Additional Documents Required", customerLabel: "Additional Documents Required", group: "Airline", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      // P08 — OTB Page Content v3 customer steps.
      { name: "Additional Documents Validated", customerLabel: "Additional Documents Validated", group: "Airline", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Additional Documents Submitted", customerLabel: "Additional Documents Submitted", group: "Airline", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "OTB Approved", customerLabel: "OTB Updated", group: "Airline", isTerminal: true, mapsToBookingStatus: "COMPLETED", blocksRefund: true, systemEvent: "DELIVERED_OTB_CONFIRMATION" },
      { name: "OTB Rejected", group: "Airline", isTerminal: true, mapsToBookingStatus: "CANCELLED", blocksRefund: true },
      // Exceptions
      { name: "OTB Not Required", group: "Exceptions", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Unable to Process", group: "Exceptions", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Cancelled", group: "Exceptions", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Refund Processing", group: "Exceptions", mapsToBookingStatus: "REFUNDED" },
      { name: "Refund Completed", group: "Exceptions", isTerminal: true, mapsToBookingStatus: "REFUNDED" },
    ],
    extraTransitions: [
      ["OTB Booking Generated", "Staff Verification Pending"],
      ["Documents Validated", "Ready for Submission"],
      ["OTB Rejected", "Refund Processing"],
      ["Cancelled", "Refund Processing"],
    ],
  },
  {
    serviceType: "FLIGHT_SPECIAL_FARE",
    // Flight_Special_Fare.md §23's "dashboard statuses" — no per-status
    // refund block noted anywhere in that MD; the existing refund rule
    // engine (src/lib/refunds/rules.ts) already treats this service as
    // "always allowed, 0 deduction" with no hard-cutoff status, so
    // blocksRefund stays false throughout, unlike the other five services.
    statuses: [
      { name: "New", mapsToBookingStatus: "PENDING" },
      { name: "Availability Pending", mapsToBookingStatus: "PENDING" },
      { name: "Quote Sent", mapsToBookingStatus: "PENDING" },
      { name: "Quote Viewed", mapsToBookingStatus: "PENDING" },
      { name: "Expiring", mapsToBookingStatus: "PENDING" },
      { name: "Expired", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "New Quote Requested", mapsToBookingStatus: "PENDING" },
      { name: "Payment Pending", customerLabel: "Quotation Approved", mapsToBookingStatus: "PENDING" },
      { name: "Paid", customerLabel: "Payment Completed", mapsToBookingStatus: "CONFIRMED", systemEvent: "PAYMENT_SUCCESS" },
      // P16 — post-payment operations (tags used by the Special Fare action route).
      { name: "Final Confirmation", mapsToBookingStatus: "CONFIRMED", systemEvent: "FSF_FINAL_CONFIRMATION" },
      // P08 — Special Fare handover customer steps; wired by explicit transitions below.
      { name: "Documents Validated", customerLabel: "Documents Validated", mapsToBookingStatus: "CONFIRMED", systemEvent: "DOCUMENTS_VALIDATED", noAutoChain: true },
      { name: "Sent to Airlines", customerLabel: "Sent to Airlines", mapsToBookingStatus: "PROCESSING", noAutoChain: true, systemEvent: "FSF_AVAILABILITY_CONFIRMED" },
      { name: "Alternative Offered", mapsToBookingStatus: "PENDING", systemEvent: "FSF_ALTERNATIVE_OFFERED" },
      { name: "Additional Payment Pending", mapsToBookingStatus: "CONFIRMED", systemEvent: "FSF_ADDITIONAL_PAYMENT_PENDING" },
      { name: "Refund Pending", mapsToBookingStatus: "REFUNDED", systemEvent: "FSF_REFUND_PENDING" },
      { name: "PNR Recorded", customerLabel: "PNR Confirmed", mapsToBookingStatus: "PROCESSING", systemEvent: "FSF_PNR_RECORDED", noAutoChain: true },
      { name: "Ticket Issued", customerLabel: "Ticket Issued", isTerminal: true, mapsToBookingStatus: "COMPLETED", systemEvent: "DELIVERED_TICKET_PDF" },
      { name: "Cancelled", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Follow-up Due", mapsToBookingStatus: "PENDING" },
    ],
    extraTransitions: [
      ["Quote Sent", "Expiring"],
      ["Quote Viewed", "Expiring"],
      ["Expiring", "Expired"],
      ["Expiring", "New Quote Requested"],
      ["Final Confirmation", "Alternative Offered"],
      ["Final Confirmation", "Additional Payment Pending"],
      ["Paid", "Cancelled"],
      ["Cancelled", "Refund Pending"],
      ["Quote Sent", "Follow-up Due"],
      ["Paid", "Documents Validated"],
      ["Final Confirmation", "Documents Validated"],
      ["Documents Validated", "Sent to Airlines"],
      ["Sent to Airlines", "Ticket Issued"],
      ["Sent to Airlines", "Cancelled"],
      // P16 — post-payment operations.
      ["Final Confirmation", "Sent to Airlines"],
      ["Final Confirmation", "Refund Pending"],
      ["Documents Validated", "Alternative Offered"],
      ["Documents Validated", "Refund Pending"],
      ["Alternative Offered", "Additional Payment Pending"],
      ["Alternative Offered", "Refund Pending"],
      ["Additional Payment Pending", "Sent to Airlines"],
      ["Sent to Airlines", "PNR Recorded"],
      ["PNR Recorded", "Ticket Issued"],
      ["PNR Recorded", "Cancelled"],
    ],
  },
];

/**
 * P08 — LEAD-scope statuses. No client doc breaks the sales funnel down per
 * service, so every service gets the same list, one status per LeadStatus
 * value (mapsToLeadStatus keeps the coarse column in sync), with the same
 * transitions src/lib/leads/transitions.ts already allowed. Admin can
 * rename, relabel or rewire them per service at /admin/service-statuses.
 */
const LEAD_STATUSES: StatusSeed[] = ([
  { name: "New", mapsToLeadStatus: "NEW" },
  { name: "Contacted", mapsToLeadStatus: "CONTACTED" },
  { name: "Follow-up Required", mapsToLeadStatus: "FOLLOW_UP_REQUIRED" },
  { name: "Customer Responded", mapsToLeadStatus: "CUSTOMER_RESPONDED" },
  { name: "Qualified", mapsToLeadStatus: "QUALIFIED" },
  { name: "Quotation Created", mapsToLeadStatus: "QUOTATION_CREATED", systemEvent: "QUOTATION_CREATED" },
  { name: "Quotation Accepted", mapsToLeadStatus: "QUOTATION_ACCEPTED", systemEvent: "QUOTATION_ACCEPTED" },
  { name: "Payment Pending", mapsToLeadStatus: "PAYMENT_PENDING" },
  { name: "Converted", mapsToLeadStatus: "CONVERTED", isTerminal: true, systemEvent: "PAYMENT_SUCCESS" },
  { name: "Lost", mapsToLeadStatus: "LOST", isTerminal: true },
  { name: "Closed", mapsToLeadStatus: "CLOSED", isTerminal: true },
] satisfies StatusSeed[]).map((status): StatusSeed => ({ ...status, noAutoChain: true }));

const LEAD_TRANSITIONS: [string, string][] = [
  ["New", "Contacted"], ["New", "Follow-up Required"], ["New", "Lost"], ["New", "Closed"],
  ["Contacted", "Follow-up Required"], ["Contacted", "Customer Responded"], ["Contacted", "Qualified"], ["Contacted", "Lost"], ["Contacted", "Closed"],
  ["Follow-up Required", "Contacted"], ["Follow-up Required", "Customer Responded"], ["Follow-up Required", "Qualified"], ["Follow-up Required", "Lost"], ["Follow-up Required", "Closed"],
  ["Customer Responded", "Qualified"], ["Customer Responded", "Follow-up Required"], ["Customer Responded", "Lost"], ["Customer Responded", "Closed"],
  ["Qualified", "Quotation Created"], ["Qualified", "Follow-up Required"], ["Qualified", "Lost"], ["Qualified", "Closed"],
  ["Quotation Created", "Quotation Accepted"], ["Quotation Created", "Follow-up Required"], ["Quotation Created", "Lost"], ["Quotation Created", "Closed"],
  ["Quotation Accepted", "Payment Pending"], ["Quotation Accepted", "Follow-up Required"], ["Quotation Accepted", "Lost"], ["Quotation Accepted", "Closed"],
  ["Payment Pending", "Converted"], ["Payment Pending", "Follow-up Required"], ["Payment Pending", "Lost"], ["Payment Pending", "Closed"],
];

const SERVICES_WITH_STATUSES = [...new Set(SERVICE_STATUS_SEED.map((def) => def.serviceType))];

export const LEAD_STATUS_SEED: ServiceStatusSeedDef[] = SERVICES_WITH_STATUSES.map((serviceType) => ({
  serviceType,
  scope: "LEAD",
  statuses: LEAD_STATUSES,
  extraTransitions: LEAD_TRANSITIONS,
}));

/** The On Hold row appended to every service's list for both scopes (transitions added by the seeder). */
export const ON_HOLD_SEED: StatusSeed = { name: ON_HOLD_STATUS_NAME, systemEvent: HOLD_MARKER, noAutoChain: true };

/** Every service × scope definition, with On Hold appended — what seed.ts and the P08 migration apply. */
export const ALL_STATUS_SEED: (ServiceStatusSeedDef & { scope: "LEAD" | "BOOKING" })[] = [
  ...SERVICE_STATUS_SEED.map((def) => ({ ...def, scope: "BOOKING" as const })),
  ...LEAD_STATUS_SEED.map((def) => ({ ...def, scope: "LEAD" as const })),
].map((def) => ({ ...def, statuses: [...def.statuses, ON_HOLD_SEED] }));

/**
 * Every transition for one definition: the auto chain (consecutive statuses
 * in the same group, skipping noAutoChain rows), the explicit extras, and
 * On Hold to/from every non-terminal status.
 */
export function transitionsFor(def: ServiceStatusSeedDef): [string, string][] {
  const byGroup = new Map<string | undefined, string[]>();
  for (const status of def.statuses) {
    if (status.noAutoChain) continue;
    const names = byGroup.get(status.group) ?? [];
    names.push(status.name);
    byGroup.set(status.group, names);
  }
  const pairs: [string, string][] = [];
  for (const names of byGroup.values()) {
    for (let i = 0; i < names.length - 1; i++) pairs.push([names[i], names[i + 1]]);
  }
  pairs.push(...(def.extraTransitions ?? []));
  for (const status of def.statuses) {
    if (status.isTerminal || status.name === ON_HOLD_STATUS_NAME) continue;
    pairs.push([status.name, ON_HOLD_STATUS_NAME], [ON_HOLD_STATUS_NAME, status.name]);
  }
  return pairs;
}
