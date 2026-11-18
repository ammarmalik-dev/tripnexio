import { describe, expect, it } from "vitest";
import { flightFieldsFromSectors, isRoundTrip, normalizeItinerary, parseStoredItinerary } from "../src/lib/quotations/itinerary";
import { serviceDetailsLine } from "../src/lib/crm/service-details";
import { tripFacts } from "../src/lib/leads/trip-summary";

describe("round-trip flights (client doc 16 Nov, A9)", () => {
  const sectors = [
    { from: "BLR", to: "DEL", departAt: "2026-12-01T06:00", arriveAt: "2026-12-01T09:00", airline: "6E", flightNumber: "6E 21" },
    { from: "DEL", to: "BLR", departAt: "2026-12-08T18:00", arriveAt: "2026-12-08T21:00", airline: "6E", flightNumber: "6E 22", leg: "RETURN" as const },
  ];

  it("takes the route and times from the outbound sectors only", () => {
    const fields = flightFieldsFromSectors(sectors);
    expect(fields?.fromAirportCode).toBe("BLR");
    expect(fields?.toAirportCode).toBe("DEL");
    expect(fields?.arrivalDateTime).toBe("2026-12-01T09:00");
    expect(fields?.flightNumber).toBe("6E 21");
  });

  it("keeps the return marker when stored and read back", () => {
    const stored = normalizeItinerary(sectors);
    expect(stored[1].leg).toBe("RETURN");
    expect(stored[0].leg).toBeUndefined();
    expect(isRoundTrip(parseStoredItinerary(JSON.parse(JSON.stringify(stored))))).toBe(true);
    expect(isRoundTrip(parseStoredItinerary(JSON.parse(JSON.stringify(stored.slice(0, 1)))))).toBe(false);
  });

  it("shows One-way / Round trip with the return date in CRM service details", () => {
    expect(serviceDetailsLine("FLIGHT_SPECIAL_FARE", { origin: "Bengaluru", destination: "Delhi" })).toBe("Bengaluru – Delhi · One-way");
    expect(serviceDetailsLine("FLIGHT_SPECIAL_FARE", { origin: "Bengaluru", destination: "Delhi", returnDate: "2026-12-08" })).toMatch(/^Bengaluru – Delhi · Round trip, returns /);
  });

  it("adds the trip type and return date to the message trip facts", () => {
    const facts = tripFacts({ serviceType: "FLIGHT_SPECIAL_FARE", paxCount: 2, travelDate: new Date("2026-12-01"), details: { origin: "Bengaluru", destination: "Delhi", returnDate: "2026-12-08" }, country: null });
    expect(facts.map((fact) => fact.label)).toEqual(["Passengers", "Route", "Travel date", "Trip", "Return date"]);
    expect(facts.find((fact) => fact.label === "Trip")?.value).toBe("Round trip");
  });
});
