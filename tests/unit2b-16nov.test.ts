import { describe, expect, it } from "vitest";
import { documentFileBlock, getAllowedNextDocumentStatuses } from "../src/lib/documents/transitions";
import { getBookingDates } from "../src/lib/crm/booking-dates";

describe("documents need a real file before uploaded / validated / rejected (client doc 16 Nov, F5)", () => {
  it("offers only 'missing' while nothing is uploaded", () => {
    expect(getAllowedNextDocumentStatuses("REQUIRED", false)).toEqual(["MISSING"]);
    expect(getAllowedNextDocumentStatuses("REQUIRED", true)).toEqual(["MISSING", "RECEIVED"]);
  });
  it("refuses those statuses without a file, or with a purged one", () => {
    expect(documentFileBlock("VERIFIED", { fileUrl: null, purgedAt: null })).toMatch(/No file has been uploaded/);
    expect(documentFileBlock("RECEIVED", { fileUrl: "/api/files/x", purgedAt: new Date() })).not.toBeNull();
    expect(documentFileBlock("VERIFIED", { fileUrl: "/api/files/x", purgedAt: null })).toBeNull();
    expect(documentFileBlock("MISSING", { fileUrl: null, purgedAt: null })).toBeNull();
  });
});

describe("processing / travel dates per service (client doc 16 Nov, G8)", () => {
  const base = { bookingCreatedAt: new Date("2026-11-01T10:00:00Z"), appliedToEmbassyAt: new Date("2026-11-03T10:00:00Z") };
  const value = (items: ReturnType<typeof getBookingDates>, key: string) => items.find((item) => item.key === key)?.value ?? null;

  it("shows the processing date for OTB, Return Ticket and Special Fare", () => {
    for (const serviceType of ["OTB", "RETURN_TICKET", "FLIGHT_SPECIAL_FARE"] as const) {
      expect(value(getBookingDates({ ...base, serviceType, details: {} }), "processingDate"), serviceType).toBe("2026-11-03T10:00:00.000Z");
    }
  });
  it("Visa Extension: the applied date is the travel date", () => {
    expect(value(getBookingDates({ ...base, serviceType: "VISA_EXTENSION", details: {} }), "appliedToEmbassyDate")).toBe("2026-11-03T10:00:00.000Z");
  });
  it("Visa Change: the A2A exit flight date wins over the request's date", () => {
    const items = getBookingDates({ ...base, serviceType: "VISA_CHANGE", details: { travelDate: "2026-11-20" }, exitDate: "2026-11-18" });
    expect(value(items, "travelDate")).toBe("2026-11-18");
    expect(value(getBookingDates({ ...base, serviceType: "VISA_CHANGE", details: { travelDate: "2026-11-20" } }), "travelDate")).toBe("2026-11-20");
  });
});
