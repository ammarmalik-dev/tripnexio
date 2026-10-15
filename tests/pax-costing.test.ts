import { describe, expect, it } from "vitest";
import { quotationMargin, quotedPassengerIds, resolvePaxCosting } from "../src/lib/quotations/pax-costing";

const passengers = [
  { id: "p1", fullName: "Asha" },
  { id: "p2", fullName: "Ravi" },
];

describe("Visa Extension / Visa Change costing per passenger", () => {
  it("sets the quote's money fields so GST falls on selling − cost − fine only", () => {
    const result = resolvePaxCosting("Visa Extension", [
      { passengerId: "p1", cost: 800, fine: 100, selling: 1000 },
      { passengerId: "p2", cost: 700, fine: 0, selling: 900 },
    ], passengers);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.totals).toEqual({ cost: 1500, fine: 100, selling: 1900, profit: 300 });
    expect(result.fields.feeAmount).toBe(1800); // selling − fine (the computed selling price adds the fine back)
    expect(result.fields.governmentFee).toBe(1500);
    // Invoice: per-passenger Govt./Vendor fee + taxable profit; the fine is its own line.
    expect(result.fields.invoiceLines).toEqual([
      { description: "Visa Extension — Asha", quantity: 1, governmentFee: 800, serviceFee: 100 },
      { description: "Visa Extension — Ravi", quantity: 1, governmentFee: 700, serviceFee: 200 },
    ]);
    expect(quotedPassengerIds(result.fields.paxCosting)).toEqual(["p1", "p2"]);
  });

  it("refuses passengers that aren't on the lead, and an empty selling amount", () => {
    expect(resolvePaxCosting("Visa Change", [{ passengerId: "x", cost: 1, fine: 0, selling: 2 }], passengers).ok).toBe(false);
    expect(resolvePaxCosting("Visa Change", [{ passengerId: "p1", cost: 0, fine: 0, selling: 0 }], passengers).ok).toBe(false);
  });

  it("takes the fine out of the margin for these services only", () => {
    expect(quotationMargin("VISA_EXTENSION", 1900, 1500, 100)).toBe(300);
    expect(quotationMargin("OTB", 1900, 1500, 100)).toBe(400);
  });
});
