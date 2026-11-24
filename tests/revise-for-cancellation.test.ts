import { describe, expect, it } from "vitest";
import { reviseForCancelledPassengers } from "../src/lib/invoices/revise-for-cancellation";

const line = (description: string, quantity: number, governmentFee: number, serviceFee: number) => ({ description, sac: null, quantity, governmentFee, serviceFee });

describe("invoice after a partial cancellation (H11)", () => {
  it("no change when nobody (or everybody) is cancelled", () => {
    expect(reviseForCancelledPassengers([line("Adult", 2, 1000, 400)], 72, [{ paxType: "ADULT", cancelled: false }, { paxType: "ADULT", cancelled: false }])).toBeNull();
    expect(reviseForCancelledPassengers([line("Adult", 1, 1000, 400)], 72, [{ paxType: "ADULT", cancelled: true }])).toBeNull();
  });

  it("per passenger-type lines lose the cancelled passengers; GST follows the service fee", () => {
    const result = reviseForCancelledPassengers(
      [line("Adult", 2, 2000, 800), line("Child", 1, 600, 200), line("Protection Plan", 1, 0, 300)],
      234,
      [
        { paxType: "ADULT", cancelled: true },
        { paxType: "ADULT", cancelled: false },
        { paxType: "CHILD", cancelled: false },
      ]
    )!;
    expect(result.remaining).toBe(2);
    expect(result.lines[0]).toMatchObject({ description: "Adult", quantity: 1, governmentFee: 1000, serviceFee: 400 });
    expect(result.lines[1]).toMatchObject({ description: "Child", quantity: 1, serviceFee: 200 });
    expect(result.lines[2]).toMatchObject({ description: "Protection Plan", serviceFee: 300 });
    // service fee 1300 -> 900
    expect(result.gstAmount).toBe(162);
  });

  it("a cancelled type's line disappears when all of its passengers are cancelled", () => {
    const result = reviseForCancelledPassengers([line("Adult", 1, 1000, 400), line("Child", 1, 600, 200)], 108, [
      { paxType: "ADULT", cancelled: false },
      { paxType: "CHILD", cancelled: true },
    ])!;
    expect(result.lines.map((row) => row.description)).toEqual(["Adult"]);
    expect(result.gstAmount).toBe(72);
  });

  it("a single lump line is reduced in proportion", () => {
    const result = reviseForCancelledPassengers([line("Visa Extension", 1, 3000, 900)], 162, [
      { paxType: "ADULT", cancelled: true },
      { paxType: "ADULT", cancelled: false },
      { paxType: "CHILD", cancelled: false },
    ])!;
    expect(result.lines[0]).toMatchObject({ quantity: 1, governmentFee: 2000, serviceFee: 600 });
    expect(result.gstAmount).toBe(108);
  });
});
