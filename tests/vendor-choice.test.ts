import { describe, expect, it } from "vitest";
import { vendorChoiceBlock } from "../src/lib/bookings/set-vendor";

describe("vendorChoiceBlock (client doc 2026-10-15, I7)", () => {
  it("waits for every customer document to be validated", () => {
    expect(vendorChoiceBlock("OTB", [{ type: "PASSPORT", status: "RECEIVED" }])).toMatch(/validated/);
    expect(vendorChoiceBlock("NEW_VISA", [])).toMatch(/validated/);
  });
  it("ignores delivered outputs and purged files", () => {
    expect(
      vendorChoiceBlock("RETURN_TICKET", [
        { type: "PASSPORT", status: "VERIFIED" },
        { type: "RESERVATION_PDF", status: "VERIFIED" },
        { type: "VISA_COPY", status: "REQUIRED", purgedAt: new Date() },
      ])
    ).toBeNull();
  });
  it("takes the vendor from the quotation for quoted services", () => {
    expect(vendorChoiceBlock("VISA_CHANGE", [{ type: "PASSPORT", status: "VERIFIED" }])).toMatch(/quotation/);
  });
  it("ignores a cancelled passenger's documents, like the Sent to Airlines check (client doc 2026-10-27, C1)", () => {
    const documents = [
      { type: "PASSPORT", status: "VERIFIED", passengerId: "p1" },
      { type: "PASSPORT", status: "REQUIRED", passengerId: "p2" },
    ];
    expect(vendorChoiceBlock("OTB", documents)).toMatch(/validated/);
    expect(vendorChoiceBlock("OTB", documents, ["p2"])).toBeNull();
  });
});
