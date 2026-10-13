import { describe, expect, it } from "vitest";
import { perPaxTotal, specialFareTotals } from "../src/lib/special-fare/pax-counts";

describe("Special Fare per-passenger pricing", () => {
  it("multiplies each rate by its passenger count", () => {
    expect(perPaxTotal({ adult: 5000, child: 4000, infant: 1000 }, { adult: 2, child: 1, infant: 1 })).toBe(15000);
    expect(perPaxTotal({}, { adult: 2, child: 0, infant: 0 })).toBeNull();
  });

  it("derives price, vendor cost and the non-taxable airline part", () => {
    expect(specialFareTotals({ adultFare: 5000, childFare: 4000, adultVendorCost: 4500, childVendorCost: 3500 }, { adult: 1, child: 1, infant: 0 })).toEqual({
      sellingPrice: 9000,
      vendorCost: 8000,
      governmentFee: 8000,
    });
  });

  it("keeps the sent totals when no per-passenger rate was entered", () => {
    expect(specialFareTotals({ sellingPrice: 7000, vendorCost: 6500 }, { adult: 1, child: 0, infant: 0 })).toEqual({ sellingPrice: 7000, vendorCost: 6500, governmentFee: 6500 });
  });
});
