import { describe, expect, it } from "vitest";
import { aggregatePassengerChecks, extensionPaxQuoteError, passengerChecksFrom } from "../src/lib/visa-extension/rules";

const details = {
  passengerChecks: {
    a: { verifiedExpiryDate: "2026-11-30", outcome: "ELIGIBLE", verifiedAt: "x" },
    b: { verifiedExpiryDate: null, outcome: "NOT_ELIGIBLE", reason: "External visa", verifiedAt: "x" },
    c: { verifiedExpiryDate: "2026-11-23", outcome: "URGENT_TODAY", verifiedAt: "x" },
    junk: { outcome: "MAYBE" },
  },
};

describe("Visa Extension per-passenger checks (E2)", () => {
  it("reads only valid checks", () => {
    expect(Object.keys(passengerChecksFrom(details))).toEqual(["a", "b", "c"]);
  });
  it("aggregates: urgent beats eligible, all not eligible = not eligible", () => {
    expect(aggregatePassengerChecks(passengerChecksFrom(details))).toEqual({ outcome: "URGENT_TODAY", verifiedExpiryDate: "2026-11-23" });
    const { c: _c, ...rest } = passengerChecksFrom(details);
    void _c;
    expect(aggregatePassengerChecks(rest)).toEqual({ outcome: "ELIGIBLE", verifiedExpiryDate: "2026-11-30" });
    expect(aggregatePassengerChecks({ b: passengerChecksFrom(details).b })?.outcome).toBe("NOT_ELIGIBLE");
    expect(aggregatePassengerChecks({})).toBeNull();
  });
  it("quotes only verified eligible passengers", () => {
    expect(extensionPaxQuoteError(details, [{ id: "a", fullName: "A" }, { id: "c", fullName: "C" }])).toBeNull();
    expect(extensionPaxQuoteError(details, [{ id: "b", fullName: "B" }])).toMatch(/not eligible/);
    expect(extensionPaxQuoteError(details, [{ id: "d", fullName: "D" }])).toMatch(/Verify D/);
    expect(extensionPaxQuoteError({}, [{ id: "d", fullName: "D" }])).toBeNull();
  });
});
