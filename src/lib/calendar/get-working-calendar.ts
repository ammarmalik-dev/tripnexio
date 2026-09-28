import { db } from "../db";
import type { HolidayCountry } from "../../generated/prisma/enums";
import { getSystemConfig } from "../settings/system-config";
import { DEFAULT_WORKING_CALENDAR, parseWeekendDays, type WorkingCalendar } from "./working-calendar";

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const LOOKAHEAD_MS = 400 * 24 * 60 * 60 * 1000;

/**
 * The real working calendar for a country: weekend days and business
 * hours from SystemConfig (Admin → System Config), holidays from the
 * Holiday table (Admin → Holidays). Falls back to Monday-Friday, 09:00-18:00
 * IST, no holidays if the data can't be read.
 */
export async function getWorkingCalendar(country: HolidayCountry): Promise<WorkingCalendar> {
  try {
    const config = await getSystemConfig();
    const raw = await db.systemConfig.findUnique({
      where: { id: "singleton" },
      select: { weekendDaysIndia: true, weekendDaysUae: true, workdayStartHour: true, workdayEndHour: true },
    });
    const now = Date.now();
    const holidays = await db.holiday.findMany({
      where: { country, active: true, date: { gte: new Date(now - LOOKBACK_MS), lte: new Date(now + LOOKAHEAD_MS) } },
      select: { date: true },
    });
    const weekend = raw ? parseWeekendDays(country === "UAE" ? raw.weekendDaysUae : raw.weekendDaysIndia) : DEFAULT_WORKING_CALENDAR.weekendDays;
    return {
      weekendDays: weekend.length > 0 ? weekend : DEFAULT_WORKING_CALENDAR.weekendDays,
      holidays: holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)),
      startHour: raw?.workdayStartHour ?? DEFAULT_WORKING_CALENDAR.startHour,
      endHour: raw?.workdayEndHour ?? DEFAULT_WORKING_CALENDAR.endHour,
      offsetMs: config.timezoneOffsetMinutes * 60 * 1000,
    };
  } catch (error) {
    console.error("[calendar] couldn't load the working calendar, using defaults", error);
    return DEFAULT_WORKING_CALENDAR;
  }
}
