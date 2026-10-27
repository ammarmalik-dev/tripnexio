import { describe, expect, it } from "vitest";
import { displayFeeSplit, effectiveGstRate, paymentServiceFeeSplit, taxableServiceAmount } from "../src/lib/invoices/service-fee";

describe("GST rule (client 2026-10-25)", () => {
  it("Tax & Fees at 0% switches GST off for every service", () => {
    expect(effectiveGstRate(0, 0.18)).toBe(0);
    expect(effectiveGstRate(0, null)).toBe(0);
  });

  it("while GST is on, a service's own rate wins, else the Tax & Fees rate", () => {
    expect(effectiveGstRate(0.18, 0.05)).toBe(0.05);
    expect(effectiveGstRate(0.18, null)).toBe(0.18);
  });

  it("taxes the configured service fee only (capped at the amount); no fee configured = nothing taxable", () => {
    expect(taxableServiceAmount(5000, 500)).toBe(500);
    expect(taxableServiceAmount(300, 500)).toBe(300);
    expect(taxableServiceAmount(5000, null)).toBe(0);
  });
});

describe("payment service-fee split (client doc 2026-10-27, C5/E4/F2)", () => {
  it("client example: selling ₹1,200, cost ₹1,000, service fee ₹20 → GST on ₹20 only, ₹1,180 is the fee column", () => {
    const split = paymentServiceFeeSplit({ netAmount: 1200, planAmount: 0, configuredFee: 20, extra: false, gstRate: 0.18 });
    expect(split).toEqual({ invoiceServiceFee: 20, gstAmount: 3.6 });
    expect(displayFeeSplit({ amount: 1200, protectionPlan: 0, invoiceServiceFee: split.invoiceServiceFee })).toEqual({ passThroughFee: 1180, serviceFee: 20 });
  });

  it("GST off in Tax & Fees = no GST at all, whatever the service says", () => {
    const split = paymentServiceFeeSplit({ netAmount: 1200, planAmount: 0, configuredFee: 20, extra: false, gstRate: effectiveGstRate(0, 0.18) });
    expect(split.gstAmount).toBe(0);
  });

  it("no service fee configured: service fee 0, no GST, the whole price is the fee column", () => {
    const split = paymentServiceFeeSplit({ netAmount: 4, planAmount: 0, configuredFee: null, extra: false, gstRate: 0.18 });
    expect(split).toEqual({ invoiceServiceFee: 0, gstAmount: 0 });
    expect(displayFeeSplit({ amount: 4, protectionPlan: 0, invoiceServiceFee: 0 })).toEqual({ passThroughFee: 4, serviceFee: 0 });
  });

  it("a Protection Plan stays taxable; an extra payment is a pass-through fee", () => {
    expect(paymentServiceFeeSplit({ netAmount: 1500, planAmount: 300, configuredFee: 20, extra: false, gstRate: 0.18 })).toEqual({ invoiceServiceFee: 20, gstAmount: 57.6 });
    expect(paymentServiceFeeSplit({ netAmount: 900, planAmount: 0, configuredFee: 20, extra: true, gstRate: 0.18 })).toEqual({ invoiceServiceFee: 0, gstAmount: 0 });
  });

  it("an older payment without a snapshot is shown as one line", () => {
    expect(displayFeeSplit({ amount: 900, protectionPlan: 0, invoiceServiceFee: null })).toEqual({ passThroughFee: 0, serviceFee: null });
  });
});
