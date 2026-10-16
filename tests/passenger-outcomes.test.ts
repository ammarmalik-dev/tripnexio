import { describe, expect, it } from "vitest";
import { bookingOutcomeLabel, passengerAmounts } from "../src/lib/bookings/passenger-outcomes";

describe("passenger outcomes (client doc 2026-10-15, I4)", () => {
  it("labels partial results", () => {
    expect(bookingOutcomeLabel([{ outcome: "APPROVED" }, { outcome: "REJECTED" }])).toBe("Partially Approved");
    expect(bookingOutcomeLabel([{ outcome: "CANCELLED" }, { outcome: null }])).toBe("Partially Cancelled");
    expect(bookingOutcomeLabel([{ outcome: "APPROVED" }, { outcome: "APPROVED" }])).toBeNull();
    expect(bookingOutcomeLabel([{ outcome: "REJECTED" }, { outcome: "REJECTED" }])).toBe("Rejected");
    expect(bookingOutcomeLabel([{ outcome: null }])).toBeNull();
  });
  it("prices each passenger from the quotation", () => {
    const passengers = [
      { passengerId: "a", paxType: "ADULT" as const, outcome: null },
      { passengerId: "b", paxType: "CHILD" as const, outcome: "CANCELLED" as const },
    ];
    expect(passengerAmounts(passengers, { sellingPrice: 300, paxCosting: [{ passengerId: "a", selling: 200 }, { passengerId: "b", selling: 100 }], cancellationCharge: 40 })).toEqual([
      { passengerId: "a", selling: 200, cancellation: 20, refund: 180 },
      { passengerId: "b", selling: 100, cancellation: 20, refund: 80 },
    ]);
    const byType = passengerAmounts(passengers, { sellingPrice: 0, invoiceLines: [{ description: "Adult", quantity: 1, governmentFee: 50, serviceFee: 100 }, { description: "Child", quantity: 1, governmentFee: 30, serviceFee: 70 }] });
    expect(byType.map((row) => row.selling)).toEqual([150, 100]);
    expect(passengerAmounts(passengers, { sellingPrice: 500, couponDiscount: 100 }).map((row) => row.selling)).toEqual([200, 200]);
  });
});
