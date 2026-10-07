import { describe, expect, it } from "vitest";
import { gstSplit } from "../src/lib/invoices/render-invoice";
import { gstinStateCode, gstStateName } from "../src/lib/gst/india-states";
import { customerBillingSchema } from "../src/lib/validation/customer-billing-schema";

const invoice = (customerState: string | null, companyGstin: string | null) => ({
  gstAmount: 450,
  gstRatePercent: 18,
  customer: { stateCode: customerState },
  company: { gstNumber: companyGstin },
});

describe("gstSplit", () => {
  it("splits into CGST + SGST when the customer is in the company's state", () => {
    expect(gstSplit(invoice("06", "06AAGCT1234A1Z5"))).toEqual([
      { label: "CGST", rate: 9, amount: 225 },
      { label: "SGST", rate: 9, amount: 225 },
    ]);
  });

  it("charges IGST for another state or outside India", () => {
    expect(gstSplit(invoice("07", "06AAGCT1234A1Z5"))).toEqual([{ label: "IGST", rate: 18, amount: 450 }]);
    expect(gstSplit(invoice("96", "06AAGCT1234A1Z5"))).toEqual([{ label: "IGST", rate: 18, amount: 450 }]);
  });

  it("falls back to a single GST row when either state is unknown", () => {
    expect(gstSplit(invoice(null, "06AAGCT1234A1Z5"))).toEqual([{ label: "GST", rate: 18, amount: 450 }]);
    expect(gstSplit(invoice("06", null))).toEqual([{ label: "GST", rate: 18, amount: 450 }]);
  });

  it("keeps an odd paisa on SGST so the halves add up", () => {
    const rows = gstSplit({ ...invoice("06", "06AAGCT1234A1Z5"), gstAmount: 100.01 });
    expect(rows[0].amount + rows[1].amount).toBeCloseTo(100.01, 2);
  });
});

describe("GST states", () => {
  it("reads the state code from a GSTIN", () => {
    expect(gstinStateCode("07abcde1234f1z5")).toBe("07");
    expect(gstinStateCode("not-a-gstin")).toBeNull();
    expect(gstStateName("27")).toBe("Maharashtra");
  });
});

describe("customerBillingSchema", () => {
  it("accepts empty values (an individual with nothing collected)", () => {
    expect(customerBillingSchema.safeParse({ billingAddress: "", billingStateCode: "", gstin: "" }).success).toBe(true);
  });

  it("rejects a GSTIN from a different state than the one selected", () => {
    const result = customerBillingSchema.safeParse({ billingAddress: "Somewhere", billingStateCode: "07", gstin: "06AAGCT1234A1Z5" });
    expect(result.success).toBe(false);
  });

  it("upper-cases and accepts a matching GSTIN", () => {
    const result = customerBillingSchema.safeParse({ billingAddress: "", billingStateCode: "06", gstin: "06aagct1234a1z5" });
    expect(result.success && result.data.gstin).toBe("06AAGCT1234A1Z5");
  });
});
