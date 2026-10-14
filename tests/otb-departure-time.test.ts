import { describe, expect, it } from "vitest";
import { evaluateOtbTravelDate } from "../src/lib/otb/processing-rules";
import { DEFAULT_WORKING_CALENDAR } from "../src/lib/calendar/working-calendar";

const rules = { standardDays: 2, urgentHours: 8, urgentAvailable: true };
// Wednesday 2026-10-14 (a working day). IST = UTC + 5:30.
const ist = (time: string) => new Date(`2026-10-14T${time}:00+05:30`);

describe("OTB same-day rule (client reply 2026-10-14: till 4 PM on working days, flight 8+ hours later)", () => {
  it("needs the departure time for same-day travel", () => {
    expect(evaluateOtbTravelDate("2026-10-14", rules, ist("00:30"), DEFAULT_WORKING_CALENDAR).status).toBe("BLOCKED");
  });

  it("accepts Express when the flight is at least 8 hours later and it's not past 4 PM", () => {
    const outcome = evaluateOtbTravelDate("2026-10-14", rules, ist("09:00"), DEFAULT_WORKING_CALENDAR, "17:30");
    expect(outcome.status).toBe("URGENT_ONLY");
    expect(outcome.allowed).toEqual(["urgent"]);
  });

  it("refuses a flight less than 8 hours away", () => {
    expect(evaluateOtbTravelDate("2026-10-14", rules, ist("10:00"), DEFAULT_WORKING_CALENDAR, "17:00").status).toBe("BLOCKED");
  });

  it("refuses after the 4 PM cut-off", () => {
    expect(evaluateOtbTravelDate("2026-10-14", rules, ist("16:30"), DEFAULT_WORKING_CALENDAR, "23:59").status).toBe("BLOCKED");
  });

  it("refuses same day when the airline's urgent TAT is over 8 hours", () => {
    expect(evaluateOtbTravelDate("2026-10-14", { ...rules, urgentHours: 10 }, ist("06:00"), DEFAULT_WORKING_CALENDAR, "23:00").status).toBe("BLOCKED");
  });
});
