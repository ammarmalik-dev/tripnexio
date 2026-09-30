import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const { couponFindUnique, couponConfigFindUnique } = vi.hoisted(() => ({
  couponFindUnique: vi.fn(),
  couponConfigFindUnique: vi.fn(),
}));

// coupons/apply.ts reads Coupon + CouponConfig through the global client —
// replaced with in-memory stubs; no database is involved.
vi.mock("@/lib/db", () => ({
  db: { coupon: { findUnique: couponFindUnique }, couponConfig: { findUnique: couponConfigFindUnique } },
}));

import { capturesAirline, computeSellingPrice, isFlightQuote, supportsItinerary } from "@/lib/quotations/pricing";
import { paymentTotal, paymentTotalInPaise } from "@/lib/payments/totals";
import { computeCouponDiscount, resolveCouponForQuotation } from "@/lib/coupons/apply";

const d = (value: number | string) => new Prisma.Decimal(value);

describe("quotation shape", () => {
  it("only Flight Special Fare uses the flight quote shape", () => {
    expect(isFlightQuote("FLIGHT_SPECIAL_FARE")).toBe(true);
    expect(isFlightQuote("OTB")).toBe(false);
    expect(isFlightQuote("NEW_VISA")).toBe(false);
  });

  it("only Visa Change supports itineraries; airline is captured for flight, Visa Change and Return Ticket", () => {
    expect(supportsItinerary("VISA_CHANGE")).toBe(true);
    expect(supportsItinerary("FLIGHT_SPECIAL_FARE")).toBe(false);
    expect(["FLIGHT_SPECIAL_FARE", "VISA_CHANGE", "RETURN_TICKET"].every((s) => capturesAirline(s as "OTB"))).toBe(true);
    expect(capturesAirline("OTB")).toBe(false);
  });
});

describe("computeSellingPrice", () => {
  it("uses the staff-entered selling price for a flight quote and ignores fee fields", () => {
    expect(computeSellingPrice("FLIGHT_SPECIAL_FARE", { sellingPrice: 12500, feeAmount: 999, fineOrCharges: 1 })).toBe(12500);
    expect(computeSellingPrice("FLIGHT_SPECIAL_FARE", {})).toBe(0);
  });

  it("totals fee + fine/charges + other charges for the simple shape", () => {
    expect(computeSellingPrice("OTB", { feeAmount: 1500, fineOrCharges: 200, otherCharges: 50 })).toBe(1750);
    expect(computeSellingPrice("NEW_VISA", { feeAmount: 4000 })).toBe(4000);
    // A client-sent sellingPrice is never trusted on the simple shape.
    expect(computeSellingPrice("NEW_VISA", { sellingPrice: 1, feeAmount: 4000, fineOrCharges: 0 })).toBe(4000);
  });

  it("adds the flight ticket only on a Visa Change itinerary", () => {
    expect(computeSellingPrice("VISA_CHANGE", { feeAmount: 1000, fineOrCharges: 250, flightTicketPrice: 9000 })).toBe(10250);
    expect(computeSellingPrice("NEW_VISA", { feeAmount: 1000, fineOrCharges: 250, flightTicketPrice: 9000 })).toBe(1250);
  });
});

describe("paymentTotal", () => {
  it("is (amount - coupon) + GST + gateway fee, rounded to paise", () => {
    const payment = { amount: d(1000), couponDiscount: d(100), gstAmount: d(50), gatewayFee: d("21.4") };
    expect(paymentTotal(payment)).toBe(971.4);
    expect(paymentTotalInPaise(payment)).toBe(97140);
  });

  it("treats a missing coupon discount as zero", () => {
    expect(paymentTotal({ amount: d(1819), couponDiscount: null, gstAmount: d("90.95"), gatewayFee: d("38.2") })).toBe(1948.15);
  });

  it("never lets the coupon push the base below zero", () => {
    expect(paymentTotal({ amount: d(500), couponDiscount: d(800), gstAmount: d(25), gatewayFee: d(10) })).toBe(35);
  });

  it("rounds away floating-point noise", () => {
    expect(paymentTotal({ amount: d("0.1"), couponDiscount: null, gstAmount: d("0.2"), gatewayFee: d(0) })).toBe(0.3);
  });
});

describe("computeCouponDiscount", () => {
  it("percentage: percent of the amount, capped by maxDiscount", () => {
    expect(computeCouponDiscount({ type: "PERCENTAGE", value: 10, maxDiscount: null }, 5000)).toBe(500);
    expect(computeCouponDiscount({ type: "PERCENTAGE", value: 10, maxDiscount: 300 }, 5000)).toBe(300);
    expect(computeCouponDiscount({ type: "PERCENTAGE", value: 10, maxDiscount: 800 }, 5000)).toBe(500);
  });

  it("fixed amount: the value, capped only when maxDiscount is lower", () => {
    expect(computeCouponDiscount({ type: "FIXED_AMOUNT", value: 750, maxDiscount: null }, 5000)).toBe(750);
    expect(computeCouponDiscount({ type: "FIXED_AMOUNT", value: 750, maxDiscount: 500 }, 5000)).toBe(500);
    expect(computeCouponDiscount({ type: "FIXED_AMOUNT", value: 750, maxDiscount: 1000 }, 5000)).toBe(750);
  });
});

describe("resolveCouponForQuotation (DB reads stubbed)", () => {
  const base = {
    id: "cp1",
    code: "SAMPLE10",
    type: "PERCENTAGE",
    value: d(10),
    maxDiscount: null,
    active: true,
    validFrom: new Date("2026-09-01T00:00:00Z"),
    validUntil: new Date("2026-10-31T00:00:00Z"),
    usageLimit: null,
    usageCount: 0,
    category: "GENERAL",
    leadId: null,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T06:00:00Z"));
    couponFindUnique.mockReset();
    couponConfigFindUnique.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("rejects any coupon on a flight quote without looking it up", async () => {
    const result = await resolveCouponForQuotation("SAMPLE10", "FLIGHT_SPECIAL_FARE", 10000, "lead1");
    expect(result.ok).toBe(false);
    expect(couponFindUnique).not.toHaveBeenCalled();
  });

  it("normalizes the code and applies the discount", async () => {
    couponFindUnique.mockResolvedValue(base);
    const result = await resolveCouponForQuotation("  sample10 ", "OTB", 1999, "lead1");
    expect(couponFindUnique).toHaveBeenCalledWith({ where: { code: "SAMPLE10" } });
    expect(result).toEqual({ ok: true, coupon: { couponId: "cp1", couponCode: "SAMPLE10", discountAmount: 199.9 } });
  });

  it("caps a fixed discount at the quote total", async () => {
    couponFindUnique.mockResolvedValue({ ...base, type: "FIXED_AMOUNT", value: d(2500) });
    const result = await resolveCouponForQuotation("SAMPLE10", "NEW_VISA", 1800, "lead1");
    expect(result.ok && result.coupon.discountAmount).toBe(1800);
  });

  it("applies the Admin employee cap to EMPLOYEE coupons", async () => {
    couponFindUnique.mockResolvedValue({ ...base, category: "EMPLOYEE", value: d(50) });
    couponConfigFindUnique.mockResolvedValue({ employeeCouponCap: d(300) });
    const result = await resolveCouponForQuotation("SAMPLE10", "NEW_VISA", 4000, "lead1");
    expect(result.ok && result.coupon.discountAmount).toBe(300);
  });

  it("rejects inactive, out-of-range, exhausted and other-lead coupons", async () => {
    couponFindUnique.mockResolvedValueOnce({ ...base, active: false });
    expect((await resolveCouponForQuotation("X", "OTB", 1000, "lead1")).ok).toBe(false);
    couponFindUnique.mockResolvedValueOnce({ ...base, validUntil: new Date("2026-09-29T00:00:00Z") });
    expect((await resolveCouponForQuotation("X", "OTB", 1000, "lead1")).ok).toBe(false);
    couponFindUnique.mockResolvedValueOnce({ ...base, usageLimit: 5, usageCount: 5 });
    expect((await resolveCouponForQuotation("X", "OTB", 1000, "lead1")).ok).toBe(false);
    couponFindUnique.mockResolvedValueOnce({ ...base, leadId: "lead2" });
    expect(await resolveCouponForQuotation("X", "OTB", 1000, "lead1")).toEqual({ ok: false, error: "No coupon found with this code." });
  });
});
