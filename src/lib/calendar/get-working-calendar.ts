import { db } from "../db";
import type { HolidayCountry } from "../../generated/prisma/enums";
import { getSystemConfig } from "../settings/system-config";
import { DEFAULT_WORKING_CALENDAR, parseWeekendDays, type WorkingCalendar } from "./working-calendar";

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Country master codes/names that mean the legacy INDIA / UAE calendars. */
const LEGACY_COUNTRY_MATCH: Record<HolidayCountry, { codes: string[]; names: string[] }> = {
  INDIA: { codes: ["IN", "IND"], names: ["India"] },
  UAE: { codes: ["AE", "ARE", "UAE"], names: ["United Arab Emirates", "UAE"] },
};

/** Holidays of one legacy calendar: the old enum value, or a Country-linked row for that country (client corrections 2026-10-05). */
export function holidayCountryWhere(country: HolidayCountry) {
  const match = LEGACY_COUNTRY_MATCH[country];
  return {
    OR: [
      { country },
      {
        countryRecord: {
          OR: [{ code: { in: match.codes, mode: "insensitive" as const } }, { name: { in: match.names, mode: "insensitive" as const } }],
        },
      },
    ],
  };
}
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
      where: { ...holidayCountryWhere(country), active: true, date: { gte: new Date(now - LOOKBACK_MS), lte: new Date(now + LOOKAHEAD_MS) } },
      select: { date: true },
    });
    // Client corrections 2026-10-05 — the country's own weekend (Admin → Holidays) wins over the System Configuration default.
    const match = LEGACY_COUNTRY_MATCH[country];
    const countryRow = await db.country.findFirst({
      where: { OR: [{ code: { in: match.codes, mode: "insensitive" } }, { name: { in: match.names, mode: "insensitive" } }], weekendDays: { not: null } },
      select: { weekendDays: true },
    });
    const weekend = countryRow?.weekendDays
      ? parseWeekendDays(countryRow.weekendDays)
      : raw
        ? parseWeekendDays(country === "UAE" ? raw.weekendDaysUae : raw.weekendDaysIndia)
        : DEFAULT_WORKING_CALENDAR.weekendDays;
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
