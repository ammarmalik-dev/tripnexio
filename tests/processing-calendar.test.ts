import { describe, expect, it } from "vitest";
import { addWorkingDays, DEFAULT_WORKING_CALENDAR, isWorkingDay, mergeCalendars, type WorkingCalendar } from "../src/lib/calendar/working-calendar";

describe("processing calendar = India + destination (client doc 16 Nov, K10)", () => {
  const india: WorkingCalendar = { ...DEFAULT_WORKING_CALENDAR, weekendDays: [0], holidays: ["2026-12-25"] };
  const destination: WorkingCalendar = { ...DEFAULT_WORKING_CALENDAR, weekendDays: [5, 6], holidays: ["2026-12-02"], startHour: 8 };
  const merged = mergeCalendars(india, destination);

  it("skips the weekly offs and public holidays of both countries, keeping India's hours", () => {
    expect(merged.weekendDays).toEqual([0, 5, 6]);
    expect(merged.holidays).toEqual(["2026-12-02", "2026-12-25"]);
    expect(merged.startHour).toBe(india.startHour);
    expect(isWorkingDay("2026-12-02", merged)).toBe(false); // destination holiday (Wednesday)
    expect(isWorkingDay("2026-12-25", merged)).toBe(false); // India holiday (Friday)
    expect(isWorkingDay("2026-12-05", merged)).toBe(false); // Saturday off at the destination
    expect(isWorkingDay("2026-12-07", merged)).toBe(true); // Monday
  });

  it("counts TAT on the merged calendar", () => {
    // Mon 30 Nov 2026 + 3 working days: Tue 1, (Wed 2 holiday), Thu 3, (Fri 4 / Sat 5 / Sun 6 off), Mon 7.
    expect(addWorkingDays(new Date("2026-11-30T04:00:00Z"), 3, merged)).toBe("2026-12-07");
    // India alone (Sunday off only) would finish earlier.
    expect(addWorkingDays(new Date("2026-11-30T04:00:00Z"), 3, india) < "2026-12-07").toBe(true);
  });
});
