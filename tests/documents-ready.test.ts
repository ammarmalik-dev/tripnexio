import { describe, expect, it } from "vitest";
import { documentsValidatedBlock } from "../src/lib/bookings/documents-ready";

describe("documents validated before Sent to Airlines / Applied (client doc 2026-10-27, C1)", () => {
  it("blocks until every passenger's documents are validated", () => {
    expect(documentsValidatedBlock([])).toMatch(/Validate/);
    expect(
      documentsValidatedBlock([
        { type: "PASSPORT", status: "VERIFIED", passengerId: "p1" },
        { type: "VISA_COPY", status: "REQUIRED", passengerId: "p1" },
      ])
    ).toMatch(/1 document/);
    expect(
      documentsValidatedBlock([
        { type: "PASSPORT", status: "VERIFIED", passengerId: "p1" },
        { type: "PASSPORT", status: "RECEIVED", passengerId: "p2" },
      ])
    ).not.toBeNull();
  });
  it("the latest copy of a document decides it", () => {
    expect(
      documentsValidatedBlock([
        { type: "PASSPORT", status: "REJECTED", passengerId: "p1", createdAt: "2026-10-20T10:00:00Z" },
        { type: "PASSPORT", status: "VERIFIED", passengerId: "p1", createdAt: "2026-10-21T10:00:00Z" },
      ])
    ).toBeNull();
    expect(
      documentsValidatedBlock([
        { type: "PASSPORT", status: "VERIFIED", passengerId: "p1", createdAt: "2026-10-20T10:00:00Z" },
        { type: "PASSPORT", status: "RECEIVED", passengerId: "p1", createdAt: "2026-10-21T10:00:00Z" },
      ])
    ).not.toBeNull();
  });
  it("ignores delivered outputs, purged files and cancelled passengers", () => {
    expect(
      documentsValidatedBlock(
        [
          { type: "PASSPORT", status: "VERIFIED", passengerId: "p1" },
          { type: "OTB_CONFIRMATION", status: "RECEIVED", passengerId: "p1" },
          { type: "VISA_COPY", status: "REQUIRED", passengerId: "p1", purgedAt: new Date() },
          { type: "PASSPORT", status: "REQUIRED", passengerId: "p2" },
        ],
        ["p2"]
      )
    ).toBeNull();
  });
});
