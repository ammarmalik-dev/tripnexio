import { describe, expect, it } from "vitest";
import { pickVendorRate } from "../src/lib/vendors/service-rates";

describe("vendor rate for an OTB / Return Ticket booking", () => {
  const rows = [
    { airlineId: null, processingType: null, cost: 500 },
    { airlineId: "air-1", processingType: null, cost: 600 },
    { airlineId: "air-1", processingType: "urgent", cost: 900 },
  ];

  it("prefers the most specific matching rate", () => {
    expect(pickVendorRate(rows, "air-1", "urgent")?.cost).toBe(900);
    expect(pickVendorRate(rows, "air-1", "normal")?.cost).toBe(600);
    expect(pickVendorRate(rows, "air-2", "urgent")?.cost).toBe(500);
  });

  it("returns null when nothing fits", () => {
    expect(pickVendorRate([{ airlineId: "air-1", processingType: null, cost: 1 }], "air-2", null)).toBeNull();
  });
});
