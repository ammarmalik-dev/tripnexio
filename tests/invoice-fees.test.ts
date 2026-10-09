import { describe, expect, it } from "vitest";
import { nonTaxableQuotationAmount } from "../src/lib/invoices/invoice-document";

const quote = (governmentFee: number, fineOrCharges: number) => ({ governmentFee, fineOrCharges }) as never;

describe("nonTaxableQuotationAmount (client testing 2026-10-09, G4/G5)", () => {
  it("is the Govt./Airline/Vendor fee for any service", () => {
    expect(nonTaxableQuotationAmount("NEW_VISA", quote(3500, 0))).toBe(3500);
    expect(nonTaxableQuotationAmount("OTB", quote(200, 0))).toBe(200);
  });

  it("adds the fine for Visa Change and Visa Extension (a pass-through fee, no GST)", () => {
    expect(nonTaxableQuotationAmount("VISA_CHANGE", quote(1000, 500))).toBe(1500);
    expect(nonTaxableQuotationAmount("VISA_EXTENSION", quote(0, 750))).toBe(750);
  });

  it("keeps other services' charges taxable", () => {
    expect(nonTaxableQuotationAmount("FLIGHT_SPECIAL_FARE", quote(0, 500))).toBe(0);
  });

  it("is 0 without a quotation", () => {
    expect(nonTaxableQuotationAmount("NEW_VISA", null)).toBe(0);
  });
});
