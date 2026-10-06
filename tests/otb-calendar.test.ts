import { describe, expect, it } from "vitest";
import {
  addWorkingDays,
  addWorkingHours,
  isWorkingDay,
  parseWeekendDays,
  workingDaysBetween,
  workingHoursBetween,
  type WorkingCalendar,
} from "@/lib/calendar/working-calendar";
import { earliestOtbTravelDates, evaluateOtbTravelDate, type OtbAirlineRules } from "@/lib/otb/processing-rules";

/** Sat/Sun weekend, 09:00-18:00 IST, one test holiday on Friday 2026-10-02. */
const calendar: WorkingCalendar = {
  weekendDays: [0, 6],
  holidays: ["2026-10-02"],
  startHour: 9,
  endHour: 18,
  offsetMs: (5 * 60 + 30) * 60 * 1000,
};

/** Wednesday 2026-09-30, 10:00 IST. */
const wed10 = new Date("2026-09-30T04:30:00Z");
const wed11 = new Date("2026-09-30T05:30:00Z");

describe("working calendar", () => {
  it("skips weekends and holidays", () => {
    expect(isWorkingDay("2026-09-30", calendar)).toBe(true);
    expect(isWorkingDay("2026-10-02", calendar)).toBe(false);
    expect(isWorkingDay("2026-10-03", calendar)).toBe(false);
    expect(isWorkingDay("not-a-date", calendar)).toBe(false);
  });

  it("parseWeekendDays keeps unique valid weekday numbers", () => {
    expect(parseWeekendDays("5, 6, 6, x, 9")).toEqual([5, 6]);
  });

  it("workingDaysBetween never counts today and skips the holiday + weekend", () => {
    expect(workingDaysBetween("2026-09-30", wed10, calendar)).toBe(0);
    expect(workingDaysBetween("2026-09-01", wed10, calendar)).toBe(0);
    expect(workingDaysBetween("2026-10-01", wed10, calendar)).toBe(1);
    expect(workingDaysBetween("2026-10-05", wed10, calendar)).toBe(2);
  });

  it("workingHoursBetween counts the rest of today plus whole working days", () => {
    expect(workingHoursBetween("2026-10-01", wed10, calendar)).toBe(8);
    expect(workingHoursBetween("2026-10-05", wed10, calendar)).toBe(17);
  });

  it("addWorkingDays is the inverse of workingDaysBetween", () => {
    expect(addWorkingDays(wed10, 0, calendar)).toBe("2026-09-30");
    expect(addWorkingDays(wed10, 2, calendar)).toBe("2026-10-05");
    for (let n = 1; n <= 10; n++) {
      expect(workingDaysBetween(addWorkingDays(wed10, n, calendar), wed10, calendar)).toBe(n);
    }
  });

  it("addWorkingHours stays inside business hours and skips non-working days", () => {
    expect(addWorkingHours(wed10, 8, calendar).toISOString()).toBe("2026-09-30T12:30:00.000Z"); // Wed 18:00 IST
    expect(addWorkingHours(wed10, 10, calendar).toISOString()).toBe("2026-10-01T05:30:00.000Z"); // Thu 11:00 IST
    expect(addWorkingHours(wed10, 20, calendar).toISOString()).toBe("2026-10-05T06:30:00.000Z"); // Mon 12:00 IST
    // From Saturday 10:00 IST, the first working hour is Monday 09:00-10:00.
    expect(addWorkingHours(new Date("2026-10-03T04:30:00Z"), 1, calendar).toISOString()).toBe("2026-10-05T04:30:00.000Z");
  });
});

describe("evaluateOtbTravelDate", () => {
  const rules: OtbAirlineRules = { standardDays: 2, urgentHours: 8, urgentAvailable: true };

  it("OK (normal + urgent) when the standard timeline fits", () => {
    expect(evaluateOtbTravelDate("2026-10-05", rules, wed10, calendar)).toMatchObject({
      status: "OK",
      allowed: ["normal", "urgent"],
      message: null,
      workingDays: 2,
    });
    expect(evaluateOtbTravelDate("2026-10-05", { ...rules, urgentAvailable: false }, wed10, calendar).allowed).toEqual(["normal"]);
  });

  it("URGENT_ONLY when inside the standard timeline but enough working hours remain", () => {
    const outcome = evaluateOtbTravelDate("2026-10-01", rules, wed10, calendar);
    expect(outcome).toMatchObject({ status: "URGENT_ONLY", allowed: ["urgent"], workingDays: 1, workingHours: 8 });
  });

  it("BLOCKED when even urgent processing can't make it", () => {
    const outcome = evaluateOtbTravelDate("2026-10-01", rules, wed11, calendar);
    expect(outcome).toMatchObject({ status: "BLOCKED", allowed: [], workingHours: 7 });
    expect(outcome.message).toContain("at least 8 working hours");
  });

  it("BLOCKED when the airline doesn't offer urgent at all", () => {
    const outcome = evaluateOtbTravelDate("2026-10-01", { ...rules, urgentAvailable: false }, wed10, calendar);
    expect(outcome.status).toBe("BLOCKED");
    expect(outcome.message).toContain("isn't available");
  });

  it("the holiday pushes a Friday-based date into the urgent-only band", () => {
    // Without the holiday, Thu + Fri = 2 working days before Sat 10-03 would be OK.
    expect(evaluateOtbTravelDate("2026-10-03", rules, wed10, { ...calendar, holidays: [] }).status).toBe("OK");
    expect(evaluateOtbTravelDate("2026-10-03", rules, wed10, calendar).status).toBe("URGENT_ONLY");
  });
});

describe("earliest OTB travel dates (client corrections 2026-10-05)", () => {
  const wed10 = new Date("2026-09-30T04:30:00Z");
  it("never offers a date the rule would block, and offers Express no later than Normal", () => {
    const rules: OtbAirlineRules = { standardDays: 2, urgentHours: 8, urgentAvailable: true };
    const earliest = earliestOtbTravelDates(rules, wed10, calendar);
    expect(earliest.normal).not.toBeNull();
    expect(evaluateOtbTravelDate(earliest.normal!, rules, wed10, calendar).allowed).toContain("normal");
    expect(evaluateOtbTravelDate(earliest.urgent!, rules, wed10, calendar).allowed).toContain("urgent");
    expect(earliest.urgent! <= earliest.normal!).toBe(true);
  });
  it("has no Express date when the airline doesn't offer it", () => {
    expect(earliestOtbTravelDates({ standardDays: 2, urgentHours: 8, urgentAvailable: false }, wed10, calendar).urgent).toBeNull();
  });
});
