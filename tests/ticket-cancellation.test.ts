import { describe, expect, it } from "vitest";
import { cancellationQuote, customerTicketFlow, isOpenFlow } from "../src/lib/special-fare/ticket-cancellation";
import { staffMoveBlock } from "../src/lib/service-status/engine";

const status = (name: string, extra: Record<string, unknown> = {}) =>
  ({ name, systemEvent: null, isTerminal: false, mapsToBookingStatus: "PROCESSING", mapsToLeadStatus: null, displayOrder: 10, ...extra }) as never;

describe("Client doc 16 Nov A12–A14 — Special Fare ticket cancellation", () => {
  it("quotes airline fee + service charge + GST on the service charge only, refund never below zero", () => {
    // Doc example: ticket ₹1000, airline fee ₹100, our charge ₹300 (+18% GST on it).
    expect(cancellationQuote({ paidShare: 1000, airlineFee: 100, serviceCharge: 300, gstRate: 0.18 })).toEqual({ gst: 54, charges: 454, refundable: 546, profit: 300 });
    expect(cancellationQuote({ paidShare: 200, airlineFee: 500, serviceCharge: 0, gstRate: 0.18 }).refundable).toBe(0);
  });

  it("A13 — staff can never hand-pick the ticket-cancellation / airline steps", () => {
    for (const name of ["Ticket Cancellation Requested", "Sent to Airlines for Cancellation", "Cancellation Quotation Sent", "Ticket Cancelled", "Cancelled by Airline", "Rescheduled by Airline"]) {
      expect(staffMoveBlock("BOOKING", status("Sent to Airlines"), status(name))).toMatch(/Ticket cancellation actions/);
    }
  });

  it("shows the customer only what waits for them (no internal profit field)", () => {
    const quoted = { kind: "CUSTOMER" as const, stage: "QUOTED" as const, passengerIds: ["p"], reason: "x", startedAt: "", paidShare: 1000, airlineFee: 100, serviceCharge: 300, gst: 54, refundable: 546, decision: null };
    const view = customerTicketFlow(quoted);
    expect(view?.waiting).toBe(true);
    expect(view?.refundable).toBe(546);
    expect(JSON.stringify(view)).not.toContain("profit");
    expect(isOpenFlow({ ...quoted, stage: "DECLINED" })).toBe(false);
    expect(customerTicketFlow({ ...quoted, stage: "DECLINED", decision: "DECLINE" })).toBeNull();
  });
});
