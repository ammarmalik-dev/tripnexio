import { describe, expect, it } from "vitest";
import { isApplyStepStatus, isRefundEngineStatus, isRefundOutcomeStatus, needsValidatedDocuments, staffMoveBlock } from "../src/lib/service-status/engine";

const s = (name: string, mapsToBookingStatus: string | null, extra: { isTerminal?: boolean; systemEvent?: string | null } = {}) =>
  ({ name, mapsToBookingStatus, mapsToLeadStatus: null, isTerminal: extra.isTerminal ?? false, systemEvent: extra.systemEvent ?? null }) as never;

describe("staff status moves (client doc 2026-10-15, I1)", () => {
  it("never lets an approved OTB become rejected", () => {
    expect(staffMoveBlock("BOOKING", s("OTB Approved", "COMPLETED", { isTerminal: true }), s("OTB Rejected", "CANCELLED", { isTerminal: true }))).toMatch(/Admin/);
    expect(staffMoveBlock("BOOKING", s("Approved", "PROCESSING"), s("Rejected", "CANCELLED", { isTerminal: true }))).toMatch(/Admin/);
  });
  it("allows a final status only on to a refund — and only the refund engine makes that move (client doc 2026-10-27, C2)", () => {
    expect(staffMoveBlock("BOOKING", s("Rejected", "CANCELLED", { isTerminal: true }), s("Refund Processing", "REFUNDED"), { refundEngine: true })).toBeNull();
    expect(staffMoveBlock("BOOKING", s("Rejected", "CANCELLED", { isTerminal: true }), s("Refund Processing", "REFUNDED"))).toMatch(/follows the refund/);
    expect(staffMoveBlock("BOOKING", s("Rejected", "CANCELLED", { isTerminal: true }), s("Visa PDF Delivered", "PROCESSING"))).toMatch(/final/);
  });
  it("blocks going back a stage but keeps re-review loops and On Hold", () => {
    expect(staffMoveBlock("BOOKING", s("Submitted to Embassy", "PROCESSING"), s("Documents Pending", "CONFIRMED"))).toMatch(/back/);
    expect(staffMoveBlock("BOOKING", s("Re-submitted", "PROCESSING"), s("Embassy Reviewing", "PROCESSING"))).toBeNull();
    expect(staffMoveBlock("BOOKING", s("On Hold", null, { systemEvent: "ON_HOLD" }), s("Documents Pending", "CONFIRMED"))).toBeNull();
    expect(staffMoveBlock("BOOKING", s("Documents Pending", "CONFIRMED"), s("Submitted to Embassy", "PROCESSING"))).toBeNull();
  });
});

describe("refund statuses (client doc 2026-10-27, C2/C3/C4)", () => {
  const sentToAirlines = s("Sent to Airlines", "PROCESSING", { systemEvent: "OTB_SUBMITTED" });
  it("staff never pick Refund Pending / Completed, Partially Cancelled or Cancelled and Refunded by hand", () => {
    expect(staffMoveBlock("BOOKING", sentToAirlines, s("Refund Completed", null, { systemEvent: "REFUND_COMPLETED" }))).toMatch(/follows the refund/);
    expect(staffMoveBlock("BOOKING", sentToAirlines, s("Refund Pending", null, { systemEvent: "REFUND_RAISED" }))).toMatch(/follows the refund/);
    expect(staffMoveBlock("BOOKING", sentToAirlines, s("Partially Cancelled", null, { systemEvent: "REFUND_PARTIALLY_COMPLETED" }))).toMatch(/follows the refund/);
    expect(staffMoveBlock("BOOKING", sentToAirlines, s("Cancelled and Refunded", "REFUNDED", { isTerminal: true, systemEvent: "CANCELLED_AND_REFUNDED" }))).toMatch(/follows the refund/);
    // An Admin-added status is caught by its name, and so is a record with no status yet.
    expect(staffMoveBlock("BOOKING", sentToAirlines, s("Partially Refunded", null))).toMatch(/follows the refund/);
    expect(staffMoveBlock("BOOKING", null, s("Refund Completed", null, { systemEvent: "REFUND_COMPLETED" }))).toMatch(/follows the refund/);
  });
  it("cancellation requests stay a staff move", () => {
    expect(staffMoveBlock("BOOKING", sentToAirlines, s("Partially Cancellation Requested", null))).toBeNull();
    expect(staffMoveBlock("BOOKING", sentToAirlines, s("Cancellation Requested", null))).toBeNull();
  });
  it("after a completed (partial) refund staff have no further moves", () => {
    const partiallyCancelled = s("Partially Cancelled", null, { systemEvent: "REFUND_PARTIALLY_COMPLETED" });
    expect(staffMoveBlock("BOOKING", partiallyCancelled, s("OTB Application Approved", "COMPLETED"))).toMatch(/final once the refund/);
    expect(staffMoveBlock("BOOKING", s("Refund Completed", null, { systemEvent: "REFUND_COMPLETED" }), s("Cancelled", "CANCELLED"))).toMatch(/final once the refund/);
    // A system rule (every passenger has a result) may still complete it.
    expect(staffMoveBlock("BOOKING", partiallyCancelled, s("OTB Application Approved", "COMPLETED"), { afterRefund: true })).toBeNull();
  });
  it("names the refund statuses", () => {
    expect(isRefundEngineStatus({ name: "Refund Pending", systemEvent: "REFUND_RAISED" })).toBe(true);
    expect(isRefundEngineStatus({ name: "Cancelled", systemEvent: "CANCELLED" })).toBe(false);
    expect(isRefundOutcomeStatus({ name: "Refund Pending", systemEvent: "REFUND_RAISED" })).toBe(false);
    expect(isRefundOutcomeStatus({ name: "Partially Cancelled", systemEvent: "REFUND_PARTIALLY_COMPLETED" })).toBe(true);
  });
});

describe("apply steps (client doc 2026-10-27, C1/C13)", () => {
  it("Sent to Airlines / Applied to Embassy come from the action panel and need validated documents", () => {
    expect(isApplyStepStatus("OTB", { systemEvent: "OTB_SUBMITTED" })).toBe(true);
    expect(isApplyStepStatus("RETURN_TICKET", { systemEvent: "SENT_TO_AIRLINES" })).toBe(true);
    expect(isApplyStepStatus("NEW_VISA", { systemEvent: "EMBASSY_APPLIED" })).toBe(true);
    expect(isApplyStepStatus("VISA_CHANGE", { systemEvent: "EMBASSY_APPLIED" })).toBe(false);
    expect(needsValidatedDocuments("OTB", { systemEvent: "OTB_ADDITIONAL_DOCUMENTS" })).toBe(true);
    expect(needsValidatedDocuments("OTB", { systemEvent: "OTB_APPROVED" })).toBe(false);
  });
});

describe("Documents Validated by hand (client doc 2026-10-27, C11)", () => {
  it("a staff move onto a validated status needs the documents really validated", () => {
    expect(needsValidatedDocuments("OTB", { systemEvent: "DOCUMENTS_VALIDATED" })).toBe(true);
    expect(needsValidatedDocuments("NEW_VISA", { systemEvent: "ADDITIONAL_DOCUMENTS_VALIDATED" })).toBe(true);
    expect(needsValidatedDocuments("OTB", { systemEvent: "DOCUMENTS_RECEIVED" })).toBe(false);
    expect(needsValidatedDocuments("OTB", { systemEvent: null })).toBe(false);
  });
});

describe("partial refund status (client 2026-10-27, RT104)", () => {
  it("recognises Partially Cancelled / Refunded, not a full refund", async () => {
    const { isPartialRefundStatus } = await import("../src/lib/service-status/engine");
    expect(isPartialRefundStatus({ name: "Partially Cancelled", systemEvent: "REFUND_PARTIALLY_COMPLETED" })).toBe(true);
    expect(isPartialRefundStatus({ name: "Partially Refunded", systemEvent: null })).toBe(true);
    expect(isPartialRefundStatus({ name: "Refund Completed", systemEvent: "REFUND_COMPLETED" })).toBe(false);
    expect(isPartialRefundStatus({ name: "Cancelled and Refunded", systemEvent: "CANCELLED_AND_REFUNDED" })).toBe(false);
  });
});

describe("no skipping the hand-over (client 2026-10-27)", () => {
  it("an outcome after Sent to Airlines / Applied to Embassy needs that step first", async () => {
    const { skipsHandover } = await import("../src/lib/service-status/engine");
    const st = (name: string, displayOrder: number, systemEvent: string | null = null) =>
      ({ name, displayOrder, systemEvent, mapsToBookingStatus: null }) as never;
    const sent = st("Sent to Airlines", 70, "SENT_TO_AIRLINES");
    const paid = st("Paid", 10, "PAYMENT_SUCCESS");
    // Return Ticket: Paid → Ticket Issued skipped Sent to Airlines.
    expect(skipsHandover(sent, paid, st("Ticket Issued", 80, "DELIVERED_RESERVATION_PDF"))).toMatch(/has to reach "Sent to Airlines"/);
    // Once sent, the next steps are open.
    expect(skipsHandover(sent, sent, st("Ticket Issued", 80, "DELIVERED_RESERVATION_PDF"))).toBeNull();
    // Steps before the hand-over and side outcomes stay available.
    expect(skipsHandover(sent, paid, st("Documents Uploaded", 40, "DOCUMENTS_RECEIVED"))).toBeNull();
    expect(skipsHandover(sent, paid, st("Cancelled", 110, "CANCELLED"))).toBeNull();
    expect(skipsHandover(sent, paid, st("On Hold", 150, "ON_HOLD"))).toBeNull();
    // The airline's answer (partial approval / rejection) only after sending.
    expect(skipsHandover(sent, paid, st("OTB Approved for Partially Applicants", 100, "PARTIAL_APPROVED"))).not.toBeNull();
    expect(skipsHandover(sent, paid, st("OTB Application Rejected", 110, "OTB_REJECTED"))).not.toBeNull();
    // A service without a hand-over step is unaffected.
    expect(skipsHandover(null, paid, st("Ticket Issued", 80))).toBeNull();
  });
});

describe("automatic statuses are not manual moves (client 2026-10-28)", () => {
  it("knows which statuses an action sets by itself", async () => {
    const { isAutoStatus } = await import("../src/lib/service-status/engine");
    const ev = (systemEvent: string | null) => ({ systemEvent }) as never;
    expect(isAutoStatus("OTB", ev("DOCUMENTS_VALIDATED"))).toBe(true);
    expect(isAutoStatus("OTB", ev("ADDITIONAL_DOCUMENTS_RECEIVED"))).toBe(true);
    expect(isAutoStatus("OTB", ev("OTB_APPROVED"))).toBe(true);
    expect(isAutoStatus("NEW_VISA", ev("EMBASSY_ADDITIONAL_DOCS"))).toBe(true);
    // Visa Extension has no Embassy panel — its Ready for Submission / Applied stay manual.
    expect(isAutoStatus("VISA_EXTENSION", ev("EMBASSY_APPLIED"))).toBe(false);
    expect(isAutoStatus("VISA_EXTENSION", ev("EXTENSION_EXTENDED"))).toBe(true);
    // Hold / cancel / no-event statuses stay manual.
    expect(isAutoStatus("OTB", ev("ON_HOLD"))).toBe(false);
    expect(isAutoStatus("OTB", ev("CANCELLED"))).toBe(false);
    expect(isAutoStatus("OTB", ev(null))).toBe(false);
  });
});
