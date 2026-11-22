import { describe, expect, it } from "vitest";
import { compareTicket, describeTicketMismatches } from "../src/lib/special-fare/ticket-check";

const expected = { passengerNames: ["Rahul Kumar Sharma", "Anita Sharma"], pnr: "AB12CD", from: "BLR", to: "DEL", departureDate: "2026-12-01" };

describe("Client doc 16 Nov A6 — ticket upload check", () => {
  it("passes a matching ticket (name order / middle names aside)", () => {
    expect(compareTicket({ passengerName: "SHARMA/RAHUL", pnr: "ab12cd", departureAirport: "Bengaluru (BLR)", arrivalAirport: "DEL", departureDate: "2026-12-01" }, expected)).toEqual([]);
  });

  it("flags a different passenger, PNR, route or date", () => {
    const found = compareTicket({ passengerName: "John Smith", pnr: "ZZ99ZZ", departureAirport: "BOM", arrivalAirport: "DEL", departureDate: "2026-12-02" }, expected);
    expect(found.map((item) => item.field)).toEqual(["Passenger name", "PNR", "Departure airport", "Departure date"]);
    expect(describeTicketMismatches(found)).toContain('PNR: ticket shows "ZZ99ZZ", booking has "AB12CD"');
  });

  it("never blocks on a field the OCR could not read", () => {
    expect(compareTicket({}, expected)).toEqual([]);
    expect(compareTicket({ departureAirport: "Bengaluru" }, expected)).toEqual([]);
  });
});
