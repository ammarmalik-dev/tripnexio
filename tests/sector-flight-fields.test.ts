import { describe, expect, it } from "vitest";
import { flightFieldsFromSectors } from "../src/lib/quotations/itinerary";

describe("Special Fare flight fields from sectors", () => {
  it("takes a direct flight's single sector as the route", () => {
    expect(flightFieldsFromSectors([{ from: "del", to: "DXB", airline: "6E", flightNumber: "6E 21", departAt: "2026-11-01T04:00:00.000Z", arriveAt: "2026-11-01T07:00:00.000Z" }])).toEqual({
      fromAirportCode: "DEL",
      toAirportCode: "DXB",
      airline: "6E",
      flightNumber: "6E 21",
      flightDateTime: "2026-11-01T04:00:00.000Z",
      arrivalDateTime: "2026-11-01T07:00:00.000Z",
    });
  });

  it("uses the last arrival for a connection and the outbound destination for a round trip", () => {
    expect(flightFieldsFromSectors([{ from: "JAI", to: "BOM" }, { from: "BOM", to: "DXB" }])?.toAirportCode).toBe("DXB");
    expect(flightFieldsFromSectors([{ from: "DEL", to: "DXB" }, { from: "DXB", to: "DEL" }])?.toAirportCode).toBe("DXB");
  });

  it("returns null with no sectors", () => {
    expect(flightFieldsFromSectors([])).toBeNull();
  });
});
