import { describe, expect, it } from "vitest";
import { manualLeadSchema } from "../src/lib/validation/manual-lead-schema";

const base = { fullName: "Asha", mobile: "+919800000000", source: "Walk-in", serviceType: "FLIGHT_SPECIAL_FARE", travelDate: "2026-12-01", adultCount: 1, childCount: 0, infantCount: 0 } as const;

function errorPaths(input: Record<string, unknown>): string[] {
  const parsed = manualLeadSchema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join("."));
}

describe("manual Special Fare lead (client doc 16 Nov, A1)", () => {
  it("needs the departure and arrival", () => {
    expect(errorPaths(base)).toEqual(expect.arrayContaining(["flightOrigin", "flightDestination"]));
  });

  it("accepts a one-way and a round trip, and refuses a return before travel or the same airport twice", () => {
    const route = { flightOrigin: "Delhi - Indira Gandhi International Airport (DEL)", flightDestination: "Dubai - Dubai International Airport (DXB)" };
    expect(errorPaths({ ...base, ...route })).toEqual([]);
    expect(errorPaths({ ...base, ...route, flightReturnDate: "2026-12-08" })).toEqual([]);
    expect(errorPaths({ ...base, ...route, flightReturnDate: "2026-11-30" })).toEqual(["flightReturnDate"]);
    expect(errorPaths({ ...base, flightOrigin: route.flightOrigin, flightDestination: route.flightOrigin })).toEqual(["flightDestination"]);
  });

  it("doesn't ask other services for a route", () => {
    expect(errorPaths({ ...base, serviceType: "OTHER", otherServiceDescription: "Hotel" })).toEqual([]);
  });
});
