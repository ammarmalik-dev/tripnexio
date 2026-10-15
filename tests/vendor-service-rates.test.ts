import { describe, expect, it } from "vitest";
import { pickVendorRate } from "../src/lib/vendors/service-rates";

describe("vendor rate for an OTB / Return Ticket booking", () => {
  const rows = [
    { airlineId: null, processingType: null, cost: 500 },
    { airlineId: "air-1", processingType: null, cost: 600 },
    { airlineId: "air-1", processingType: "urgent", cost: 900 },
  ];

  it("prefers the most specific matching rate", () => {
    expect(pickVendorRate(rows, { airlineId: "air-1", processingType: "urgent" })?.cost).toBe(900);
    expect(pickVendorRate(rows, { airlineId: "air-1", processingType: "normal" })?.cost).toBe(600);
    expect(pickVendorRate(rows, { airlineId: "air-2", processingType: "urgent" })?.cost).toBe(500);
  });

  it("returns null when nothing fits", () => {
    expect(pickVendorRate([{ airlineId: "air-1", processingType: null, cost: 1 }], { airlineId: "air-2", processingType: null })).toBeNull();
  });
});

describe("vendor rate for a New Visa passenger", () => {
  const rows = [
    { airlineId: null, processingType: null, nationalityId: null, paxType: null, cost: 4000 },
    { airlineId: null, processingType: null, nationalityId: null, paxType: "CHILD", cost: 3000 },
    { airlineId: null, processingType: "urgent", nationalityId: "nat-in", paxType: "ADULT", cost: 5500 },
    { airlineId: null, processingType: null, nationalityId: "nat-in", paxType: null, cost: 4500 },
  ];

  it("matches nationality, passenger type and processing type", () => {
    expect(pickVendorRate(rows, { processingType: "urgent", nationalityId: "nat-in", paxType: "ADULT" })?.cost).toBe(5500);
    expect(pickVendorRate(rows, { processingType: "normal", nationalityId: "nat-in", paxType: "ADULT" })?.cost).toBe(4500);
    expect(pickVendorRate(rows, { processingType: "normal", nationalityId: "nat-pk", paxType: "CHILD" })?.cost).toBe(3000);
    expect(pickVendorRate(rows, { processingType: "normal", nationalityId: null, paxType: "ADULT" })?.cost).toBe(4000);
  });
});
