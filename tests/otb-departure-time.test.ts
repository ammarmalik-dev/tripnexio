import { describe, expect, it } from "vitest";
import { evaluateOtbTravelDate } from "../src/lib/otb/processing-rules";
import { DEFAULT_WORKING_CALENDAR } from "../src/lib/calendar/working-calendar";

const rules = { standardDays: 2, urgentHours: 8, urgentAvailable: true };
// Wednesday 2026-10-14, 00:30 IST (= 2026-10-13T19:00Z).
const at = new Date("2026-10-13T19:00:00Z");

describe("OTB Express with a departure time", () => {
  it("blocks same-day travel when no departure time is given", () => {
    expect(evaluateOtbTravelDate("2026-10-14", rules, at, DEFAULT_WORKING_CALENDAR).status).toBe("BLOCKED");
  });

  it("allows Express when 8 working hours finish before the flight", () => {
    const outcome = evaluateOtbTravelDate("2026-10-14", rules, at, DEFAULT_WORKING_CALENDAR, "17:30");
    expect(outcome.status).toBe("URGENT_ONLY");
    expect(outcome.allowed).toEqual(["urgent"]);
  });

  it("still blocks when the flight leaves before the 8 working hours are done", () => {
    expect(evaluateOtbTravelDate("2026-10-14", rules, at, DEFAULT_WORKING_CALENDAR, "15:00").status).toBe("BLOCKED");
  });
});
