import { describe, expect, it } from "vitest";
import { effectiveGstRate, taxableServiceAmount } from "../src/lib/invoices/service-fee";

describe("GST rule (client 2026-10-25)", () => {
  it("Tax & Fees at 0% switches GST off for every service", () => {
    expect(effectiveGstRate(0, 0.18)).toBe(0);
    expect(effectiveGstRate(0, null)).toBe(0);
  });

  it("while GST is on, a service's own rate wins, else the Tax & Fees rate", () => {
    expect(effectiveGstRate(0.18, 0.05)).toBe(0.05);
    expect(effectiveGstRate(0.18, null)).toBe(0.18);
  });

  it("taxes the service fee when set (capped at the amount), else the amount less the non-taxable fee", () => {
    expect(taxableServiceAmount(5000, 500)).toBe(500);
    expect(taxableServiceAmount(300, 500)).toBe(300);
    expect(taxableServiceAmount(5000, null, 4200)).toBe(800);
    expect(taxableServiceAmount(1000, null, 1500)).toBe(0);
  });
});
