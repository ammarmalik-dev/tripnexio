import { describe, expect, it } from "vitest";
import { staffMoveBlock } from "../src/lib/service-status/engine";

const s = (name: string, mapsToBookingStatus: string | null, extra: { isTerminal?: boolean; systemEvent?: string | null } = {}) =>
  ({ name, mapsToBookingStatus, mapsToLeadStatus: null, isTerminal: extra.isTerminal ?? false, systemEvent: extra.systemEvent ?? null }) as never;

describe("staff status moves (client doc 2026-10-15, I1)", () => {
  it("never lets an approved OTB become rejected", () => {
    expect(staffMoveBlock("BOOKING", s("OTB Approved", "COMPLETED", { isTerminal: true }), s("OTB Rejected", "CANCELLED", { isTerminal: true }))).toMatch(/Admin/);
    expect(staffMoveBlock("BOOKING", s("Approved", "PROCESSING"), s("Rejected", "CANCELLED", { isTerminal: true }))).toMatch(/Admin/);
  });
  it("allows a final status only on to a refund", () => {
    expect(staffMoveBlock("BOOKING", s("Rejected", "CANCELLED", { isTerminal: true }), s("Refund Processing", "REFUNDED"))).toBeNull();
    expect(staffMoveBlock("BOOKING", s("Rejected", "CANCELLED", { isTerminal: true }), s("Visa PDF Delivered", "PROCESSING"))).toMatch(/final/);
  });
  it("blocks going back a stage but keeps re-review loops and On Hold", () => {
    expect(staffMoveBlock("BOOKING", s("Submitted to Embassy", "PROCESSING"), s("Documents Pending", "CONFIRMED"))).toMatch(/back/);
    expect(staffMoveBlock("BOOKING", s("Re-submitted", "PROCESSING"), s("Embassy Reviewing", "PROCESSING"))).toBeNull();
    expect(staffMoveBlock("BOOKING", s("On Hold", null, { systemEvent: "ON_HOLD" }), s("Documents Pending", "CONFIRMED"))).toBeNull();
    expect(staffMoveBlock("BOOKING", s("Documents Pending", "CONFIRMED"), s("Submitted to Embassy", "PROCESSING"))).toBeNull();
  });
});
