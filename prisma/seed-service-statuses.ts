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
 * proposed-default lifecycle in this schema. `customerLabel` is left null
 * everywhere except the one literal example CRM.md §14 itself gives
 * (New Visa's "Applied to Embassy" -> "Application submitted for
 * processing", applied to New Visa's closest equivalent status,
 * "Submitted to Embassy") — ADMIN.md §45 #6 lists the full mapping as an
 * explicitly open item, not something to invent.
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
import type { ServiceType, BookingStatus } from "../src/generated/prisma/enums";

export interface StatusSeed {
  name: string;
  group?: string;
  isTerminal?: boolean;
  blocksRefund?: boolean;
  customerLabel?: string;
  mapsToBookingStatus?: BookingStatus;
}

export interface ServiceStatusSeedDef {
  serviceType: ServiceType;
  statuses: StatusSeed[];
  /** Extra transitions beyond the auto-generated "next in same group" chain, as [fromName, toName] pairs. */
  extraTransitions?: [string, string][];
}

export const SERVICE_STATUS_SEED: ServiceStatusSeedDef[] = [
  {
    serviceType: "NEW_VISA",
    statuses: [
      { name: "Draft", mapsToBookingStatus: "PENDING" },
      { name: "Payment Pending", mapsToBookingStatus: "PENDING" },
      { name: "Payment Received", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Pending", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Received", mapsToBookingStatus: "CONFIRMED" },
      { name: "OCR / Validation", mapsToBookingStatus: "CONFIRMED" },
      { name: "Staff Verification", mapsToBookingStatus: "CONFIRMED" },
      { name: "Ready for Submission", mapsToBookingStatus: "CONFIRMED" },
      {
        name: "Submitted to Embassy",
        mapsToBookingStatus: "PROCESSING",
        blocksRefund: true,
        customerLabel: "Application submitted for processing.",
      },
      { name: "Embassy Reviewing", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Additional Document Requested", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Customer Upload Pending", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Re-validation", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Re-submitted", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Approved", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Rejected", isTerminal: true, mapsToBookingStatus: "CANCELLED", blocksRefund: true },
      { name: "Visa PDF Delivered", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Completed", isTerminal: true, mapsToBookingStatus: "COMPLETED", blocksRefund: true },
    ],
    extraTransitions: [
      ["Embassy Reviewing", "Rejected"],
      ["Re-submitted", "Embassy Reviewing"],
      ["Re-submitted", "Approved"],
      ["Re-submitted", "Rejected"],
    ],
  },
  {
    serviceType: "VISA_EXTENSION",
    statuses: [
      { name: "Extension Lead Created", mapsToBookingStatus: "PENDING" },
      { name: "Under Staff Review", mapsToBookingStatus: "PENDING" },
      { name: "Visa Verification Required", mapsToBookingStatus: "PENDING" },
      { name: "Eligibility Review", mapsToBookingStatus: "PENDING" },
      { name: "Vendor/Sponsor Selected", mapsToBookingStatus: "CONFIRMED" },
      { name: "Quotation Ready", mapsToBookingStatus: "CONFIRMED" },
      { name: "Payment Pending", mapsToBookingStatus: "CONFIRMED" },
      { name: "Payment Received", mapsToBookingStatus: "CONFIRMED" },
      { name: "Processing", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Additional Information Required", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Re-processing", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Extended", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Visa Delivered", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Completed", isTerminal: true, mapsToBookingStatus: "COMPLETED", blocksRefund: true },
      // Alternative outcomes (Visa_Extension.md §19) — Not Accepted vs.
      // Rejected are the two-different-refund-treatment split already
      // built as Booking.extensionOutcome in Step 15.
      { name: "Not Eligible", group: "Alternative Outcomes", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Not Accepted", group: "Alternative Outcomes", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Rejected", group: "Alternative Outcomes", isTerminal: true, mapsToBookingStatus: "CANCELLED", blocksRefund: true },
      { name: "Cancelled", group: "Alternative Outcomes", isTerminal: true, mapsToBookingStatus: "CANCELLED" },
      { name: "Refund Processing", group: "Alternative Outcomes", mapsToBookingStatus: "REFUNDED" },
      { name: "Refund Completed", group: "Alternative Outcomes", isTerminal: true, mapsToBookingStatus: "REFUNDED" },
    ],
    extraTransitions: [
      ["Processing", "Not Eligible"],
      ["Processing", "Not Accepted"],
      ["Processing", "Rejected"],
      ["Not Accepted", "Refund Processing"],
      ["Rejected", "Refund Processing"],
      ["Cancelled", "Refund Processing"],
    ],
  },
  {
    serviceType: "VISA_CHANGE",
    statuses: [
      { name: "Lead Created", mapsToBookingStatus: "PENDING" },
      { name: "Availability Check", mapsToBookingStatus: "PENDING" },
      { name: "Availability Confirmed", mapsToBookingStatus: "PENDING" },
      { name: "Customer Notified", mapsToBookingStatus: "PENDING" },
      { name: "Date/Time/Package Selected", mapsToBookingStatus: "PENDING" },
      { name: "Payment Pending", mapsToBookingStatus: "PENDING" },
      { name: "Payment Received", mapsToBookingStatus: "CONFIRMED" },
      { name: "Booking ID Generated", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Pending", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Received", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Verified", mapsToBookingStatus: "CONFIRMED" },
      { name: "Package Generated", mapsToBookingStatus: "PROCESSING" },
      { name: "Exit Pending", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Exit Completed", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "New Visa Processing", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Additional Documents Required", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Visa Approved", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Visa Rejected", isTerminal: true, mapsToBookingStatus: "CANCELLED", blocksRefund: true },
      { name: "Visa Delivered", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Completed", isTerminal: true, mapsToBookingStatus: "COMPLETED", blocksRefund: true },
    ],
    extraTransitions: [["New Visa Processing", "Visa Rejected"]],
  },
  {
    serviceType: "RETURN_TICKET",
    statuses: [
      { name: "Return Ticket Upsell Offered", mapsToBookingStatus: "PENDING" },
      { name: "Application Started", mapsToBookingStatus: "PENDING" },
      { name: "Payment Pending", mapsToBookingStatus: "PENDING" },
      { name: "Payment Successful", mapsToBookingStatus: "CONFIRMED" },
      { name: "Booking Generated", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Required", mapsToBookingStatus: "CONFIRMED" },
      { name: "Document Validation Pending", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Validated", mapsToBookingStatus: "CONFIRMED" },
      {
        name: "Forwarded to Airline / Vendor",
        mapsToBookingStatus: "PROCESSING",
        blocksRefund: true,
      },
      { name: "Ticket / Reservation Processing", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Ticket Issued", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Delivered", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Completed", isTerminal: true, mapsToBookingStatus: "COMPLETED", blocksRefund: true },
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
      { name: "OTB Application Started", group: "Booking", mapsToBookingStatus: "PENDING" },
      { name: "Payment Pending", group: "Booking", mapsToBookingStatus: "PENDING" },
      { name: "Payment Successful", group: "Booking", mapsToBookingStatus: "CONFIRMED" },
      { name: "OTB Booking Generated", group: "Booking", mapsToBookingStatus: "CONFIRMED" },
      // Verification
      { name: "Staff Verification Pending", group: "Verification", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Required", group: "Verification", mapsToBookingStatus: "CONFIRMED" },
      { name: "Document Validation Pending", group: "Verification", mapsToBookingStatus: "CONFIRMED" },
      { name: "Documents Validated", group: "Verification", mapsToBookingStatus: "CONFIRMED" },
      // Airline
      { name: "Ready for Submission", group: "Airline", mapsToBookingStatus: "CONFIRMED" },
      { name: "Submitted to Airline", group: "Airline", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Airline Processing", group: "Airline", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "Additional Documents Required", group: "Airline", mapsToBookingStatus: "PROCESSING", blocksRefund: true },
      { name: "OTB Approved", group: "Airline", isTerminal: true, mapsToBookingStatus: "COMPLETED", blocksRefund: true },
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
      { name: "Payment Pending", mapsToBookingStatus: "PENDING" },
      { name: "Paid", mapsToBookingStatus: "CONFIRMED" },
      { name: "Final Confirmation", mapsToBookingStatus: "CONFIRMED" },
      { name: "Alternative Offered", mapsToBookingStatus: "PENDING" },
      { name: "Additional Payment Pending", mapsToBookingStatus: "CONFIRMED" },
      { name: "Refund Pending", mapsToBookingStatus: "REFUNDED" },
      { name: "Ticket Issued", isTerminal: true, mapsToBookingStatus: "COMPLETED" },
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
    ],
  },
];
