import { db } from "../db";
import { getWorkingCalendar, holidayCountryWhere } from "../calendar/get-working-calendar";
import { isWorkingDay, localDate, nextWorkingDay } from "../calendar/working-calendar";
import { DAY_MS, URGENT_DEADLINE_HOUR, type UrgentDeadline } from "./rules";

/** The UAE-calendar local day for `now`, for computeEligibilityOutcome. */
export async function extensionToday(now = new Date()): Promise<string> {
  return localDate(now, await getWorkingCalendar("UAE"));
}

/**
 * P13 — the 6:00 PM same-working-day payment deadline for an URGENT_TODAY
 * case: today at 18:00 on the UAE working calendar, or the next working day
 * when today isn't one or 6 PM has already passed. Flags UAE/India holidays
 * on the following day as an extra urgent warning.
 */
export async function computeUrgentDeadline(now = new Date()): Promise<UrgentDeadline> {
  const calendar = await getWorkingCalendar("UAE");
  const today = localDate(now, calendar);
  const todayDeadline = Date.parse(`${today}T${String(URGENT_DEADLINE_HOUR).padStart(2, "0")}:00:00Z`) - calendar.offsetMs;
  const day = isWorkingDay(today, calendar) && now.getTime() < todayDeadline ? today : nextWorkingDay(today, calendar);
  const at = new Date(Date.parse(`${day}T${String(URGENT_DEADLINE_HOUR).padStart(2, "0")}:00:00Z`) - calendar.offsetMs).toISOString();

  const nextDay = new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS);
  // Only the India and UAE calendars matter for the extension deadline.
  const holidays = await db.holiday.findMany({
    where: { date: nextDay, active: true, OR: [holidayCountryWhere("UAE"), holidayCountryWhere("INDIA")] },
    select: { country: true, name: true, countryRecord: { select: { code: true } } },
    orderBy: { country: "asc" },
  });
  return {
    day,
    at,
    nextDayHolidays: holidays.map((holiday) => ({
      country: holiday.country ?? (["AE", "ARE", "UAE"].includes(holiday.countryRecord?.code.toUpperCase() ?? "") ? ("UAE" as const) : ("INDIA" as const)),
      name: holiday.name,
    })),
  };

}

