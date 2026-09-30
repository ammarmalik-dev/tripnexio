import { describe, expect, it, vi } from "vitest";

// refunds/config.ts imports the global Prisma client for getRefundConfig();
// only its DEFAULT_REFUND_CONFIG constant is used here.
vi.mock("@/lib/db", () => ({ db: {} }));

import { DEFAULT_REFUND_CONFIG } from "@/lib/refunds/config";
import { documentsValidated, evaluateRefundRule, packageGenerated, type RefundRuleContext } from "@/lib/refunds/rules";
import { computeRefundAmount } from "@/lib/refunds/pricing";

const paidAt = new Date("2026-09-30T04:00:00Z");
const HOUR = 60 * 60 * 1000;

function context(overrides: Partial<RefundRuleContext> = {}): RefundRuleContext {
  return {
    serviceType: "NEW_VISA",
    bookingStatus: "CONFIRMED",
    documentsValidated: false,
    extensionOutcome: null,
    paymentSucceededAt: paidAt,
    now: new Date(paidAt.getTime() + HOUR),
    ...overrides,
  };
}

const rule = (overrides: Partial<RefundRuleContext>) =>
  evaluateRefundRule(context(overrides), DEFAULT_REFUND_CONFIG[overrides.serviceType ?? "NEW_VISA"]);

describe("evaluateRefundRule — full-refund window (New Visa, 4h)", () => {
  it("only gateway charges inside the window, inclusive of the boundary", () => {
    expect(rule({ now: new Date(paidAt.getTime() + 3 * HOUR) })).toMatchObject({ allowed: true, fixedDeduction: 0 });
    expect(rule({ now: new Date(paidAt.getTime() + 4 * HOUR) })).toMatchObject({ allowed: true, fixedDeduction: 0 });
  });

  it("applies the ₹250 deduction once the window has passed", () => {
    expect(rule({ now: new Date(paidAt.getTime() + 4 * HOUR + 1) })).toMatchObject({ allowed: true, fixedDeduction: 250 });
  });
});

describe("evaluateRefundRule — cutoffs", () => {
  it("blocks after external submission (booking PROCESSING/COMPLETED with no per-service status)", () => {
    expect(rule({ bookingStatus: "PROCESSING" }).allowed).toBe(false);
    expect(rule({ bookingStatus: "COMPLETED" }).allowed).toBe(false);
  });

  it("the per-service blocksRefund flag overrides the booking-status fallback both ways", () => {
    expect(rule({ bookingStatus: "PROCESSING", blocksRefund: false }).allowed).toBe(true);
    expect(rule({ bookingStatus: "CONFIRMED", blocksRefund: true }).allowed).toBe(false);
  });

  it("Visa Change blocks once the package is generated (or the booking completed), not on submission", () => {
    expect(rule({ serviceType: "VISA_CHANGE", packageGenerated: true }).allowed).toBe(false);
    expect(rule({ serviceType: "VISA_CHANGE", bookingStatus: "COMPLETED" }).allowed).toBe(false);
    expect(rule({ serviceType: "VISA_CHANGE", bookingStatus: "PROCESSING" })).toMatchObject({ allowed: true, fixedDeduction: 250 });
  });
});

describe("evaluateRefundRule — per-service deductions", () => {
  it("OTB deducts ₹250 only after document validation", () => {
    expect(rule({ serviceType: "OTB", documentsValidated: true })).toMatchObject({ allowed: true, fixedDeduction: 250 });
    expect(rule({ serviceType: "OTB", documentsValidated: false })).toMatchObject({ allowed: true, fixedDeduction: 0 });
  });

  it("Return Ticket: blocked once forwarded; otherwise the destination cancellation fee", () => {
    expect(rule({ serviceType: "RETURN_TICKET", bookingStatus: "PROCESSING" }).allowed).toBe(false);
    expect(rule({ serviceType: "RETURN_TICKET", cancellationFee: 1500 })).toMatchObject({ allowed: true, fixedDeduction: 1500 });
    expect(rule({ serviceType: "RETURN_TICKET", cancellationFee: null })).toMatchObject({ allowed: true, fixedDeduction: 0 });
  });

  it("Visa Extension: Rejected = no refund, Not Accepted = gateway charges only", () => {
    expect(rule({ serviceType: "VISA_EXTENSION", extensionOutcome: "REJECTED" }).allowed).toBe(false);
    expect(rule({ serviceType: "VISA_EXTENSION", extensionOutcome: "NOT_ACCEPTED" })).toMatchObject({ allowed: true, fixedDeduction: 0 });
    // Cutoff NEVER: still refundable while processing.
    expect(rule({ serviceType: "VISA_EXTENSION", bookingStatus: "PROCESSING" }).allowed).toBe(true);
  });
});

describe("document helpers", () => {
  it("documentsValidated needs at least one document and every one VERIFIED", () => {
    expect(documentsValidated([])).toBe(false);
    expect(documentsValidated([{ status: "VERIFIED" }, { status: "VERIFIED" }])).toBe(true);
    expect(documentsValidated([{ status: "VERIFIED" }, { status: "RECEIVED" }])).toBe(false);
  });

  it("packageGenerated looks for a PACKAGE_PDF document", () => {
    expect(packageGenerated([{ type: "PASSPORT" }, { type: "PACKAGE_PDF" }])).toBe(true);
    expect(packageGenerated([{ type: "PASSPORT" }])).toBe(false);
  });
});

describe("computeRefundAmount", () => {
  it("is paid - cancellation - gateway - fixed deduction", () => {
    expect(computeRefundAmount({ paidAmount: 1819, cancellationCharge: 150, gatewayCharge: 34, fixedDeduction: 500 })).toBe(1135);
    expect(computeRefundAmount({ paidAmount: 5000, cancellationCharge: 0, gatewayCharge: 0, fixedDeduction: 0 })).toBe(5000);
  });

  it("clamps at zero", () => {
    expect(computeRefundAmount({ paidAmount: 300, cancellationCharge: 200, gatewayCharge: 50, fixedDeduction: 250 })).toBe(0);
  });
});
