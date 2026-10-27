import { describe, expect, it } from "vitest";
import { invoiceSettlementStatus } from "../src/lib/invoices/invoice-status";

const base = { paidTotal: 1020, gatewayFee: 20, bookingStatus: "CONFIRMED", serviceStatus: null, refunds: [] };

describe("invoice settlement status (client doc 2026-10-27, F1)", () => {
  it("is Paid while nothing was cancelled or refunded", () => {
    expect(invoiceSettlementStatus(base)).toBe("Paid");
    expect(invoiceSettlementStatus({ ...base, serviceStatus: { name: "Applied to Embassy", mapsToBookingStatus: "PROCESSING" } })).toBe("Paid");
  });

  it("is Cancelled once the booking is cancelled (coarse status, status name or mapping) or a full refund is under way", () => {
    expect(invoiceSettlementStatus({ ...base, bookingStatus: "CANCELLED" })).toBe("Cancelled");
    expect(invoiceSettlementStatus({ ...base, serviceStatus: { name: "Booking Cancelled", mapsToBookingStatus: null } })).toBe("Cancelled");
    expect(invoiceSettlementStatus({ ...base, serviceStatus: { name: "OTB Application Rejected", mapsToBookingStatus: "CANCELLED" } })).toBe("Cancelled");
    expect(invoiceSettlementStatus({ ...base, refunds: [{ status: "PROCESSING", refundAmount: 1000 }] })).toBe("Cancelled");
  });

  it("a partial cancellation or a small pending refund is not Cancelled", () => {
    expect(invoiceSettlementStatus({ ...base, serviceStatus: { name: "Partially Cancelled", mapsToBookingStatus: null } })).toBe("Paid");
    expect(invoiceSettlementStatus({ ...base, refunds: [{ status: "PENDING", refundAmount: 300 }] })).toBe("Paid");
  });

  it("is Refunded / Partially Refunded once a refund completed", () => {
    expect(invoiceSettlementStatus({ ...base, refunds: [{ status: "COMPLETED", refundAmount: 1000 }] })).toBe("Refunded");
    expect(invoiceSettlementStatus({ ...base, refunds: [{ status: "COMPLETED", refundAmount: 400 }] })).toBe("Partially Refunded");
    expect(invoiceSettlementStatus({ ...base, bookingStatus: "REFUNDED", refunds: [{ status: "COMPLETED", refundAmount: 400 }] })).toBe("Refunded");
  });
});
