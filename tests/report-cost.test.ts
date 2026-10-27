import { describe, expect, it } from "vitest";
import { quotationCost } from "../src/lib/reports/finance/shared";

describe("report cost = selling − margin (client 2026-10-28)", () => {
  it("counts a Visa Extension fine as cost, so profit matches the quotation margin", () => {
    // selling 1500, vendor cost 800, fine 200 → margin 500 → cost 1000.
    expect(quotationCost({ vendorCost: "800", sellingPrice: "1500", margin: "500" })).toBe(1000);
  });
  it("falls back to the vendor cost when the margin is unknown", () => {
    expect(quotationCost({ vendorCost: "17500", sellingPrice: "20000", margin: null })).toBe(17500);
  });
});
