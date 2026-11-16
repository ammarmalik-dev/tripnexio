import { describe, expect, it } from "vitest";
import { earliestOtbTravelDates } from "../src/lib/otb/processing-rules";
import { IST_OFFSET_MS, type WorkingCalendar } from "../src/lib/calendar/working-calendar";

// Client doc 16 Nov (K11): working hours 10:00–19:00, Mon–Fri; tested Monday 2 Nov 2026 at 8:00 PM IST.
const calendar: WorkingCalendar = { weekendDays: [0, 6], holidays: [], startHour: 10, endHour: 19, offsetMs: IST_OFFSET_MS };
const mondayEvening = new Date("2026-11-02T14:30:00Z"); // 20:00 IST

describe("earliestOtbTravelDates", () => {
  it("Urgent (8 working hours) is earlier than Normal (2 working days)", () => {
    const rules = { standardDays: 2, urgentHours: 8, urgentAvailable: true };
    expect(earliestOtbTravelDates(rules, mondayEvening, calendar)).toEqual({ normal: "2026-11-04", urgent: "2026-11-03", urgentFlightAfter: "18:00" });
  });

  it("an Urgent TAT longer than one working day moves to the next day", () => {
    const rules = { standardDays: 2, urgentHours: 12, urgentAvailable: true };
    expect(earliestOtbTravelDates(rules, mondayEvening, calendar).urgent).toBe("2026-11-04");
  });
});
