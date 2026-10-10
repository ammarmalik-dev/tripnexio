import { describe, expect, it } from "vitest";
import { documentDisplayName, reviewRoundOutcome } from "../src/lib/documents/review-round";

const doc = (type: string, status: "REQUIRED" | "RECEIVED" | "VERIFIED" | "REJECTED" | "MISSING", rejectionReason: string | null = null) => ({ type, status, rejectionReason });

describe("document review round (client testing 2026-10-09, E10)", () => {
  it("sends nothing while a document still waits for staff", () => {
    expect(reviewRoundOutcome([doc("PASSPORT", "VERIFIED"), doc("PHOTO", "RECEIVED")]).kind).toBe("IN_PROGRESS");
    expect(reviewRoundOutcome([]).kind).toBe("IN_PROGRESS");
  });

  it("announces a fully validated set once", () => {
    expect(reviewRoundOutcome([doc("PASSPORT", "VERIFIED"), doc("PHOTO", "VERIFIED")])).toEqual({ kind: "ALL_VALIDATED", count: 2 });
  });

  it("lists what is rejected or missing, with reasons, in one message", () => {
    const outcome = reviewRoundOutcome([doc("PASSPORT_FRONT", "REJECTED", "blurry"), doc("Recent Photograph", "MISSING"), doc("VISA_COPY", "VERIFIED")]);
    expect(outcome).toEqual({ kind: "ACTION_REQUIRED", summary: "Passport front (blurry); Recent Photograph", count: 2 });
  });

  it("does not announce 'all validated' while a document was never uploaded", () => {
    expect(reviewRoundOutcome([doc("PASSPORT", "VERIFIED"), doc("PHOTO", "REQUIRED")]).kind).toBe("IN_PROGRESS");
  });

  it("makes a stored code readable", () => {
    expect(documentDisplayName("VISA_COPY")).toBe("Visa copy");
    expect(documentDisplayName("Passport Last Page")).toBe("Passport Last Page");
  });
});
