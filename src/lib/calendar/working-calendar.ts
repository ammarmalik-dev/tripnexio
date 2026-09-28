/**
 * P09 — working-day calendar shared by every service rule that counts
 * business days/hours (OTB timelines, the New Visa minimum-days rule, the
 * Visa Extension same-day deadline). Pure — safe on the client too; the
 * server builds the real calendar from SystemConfig + Holiday rows via
 * getWorkingCalendar() (./get-working-calendar.ts).
 */
export interface WorkingCalendar {
  /** JS weekday numbers (0 = Sunday ... 6 = Saturday) that are not working days. */
  weekendDays: number[];
  /** Public holidays as "YYYY-MM-DD" (in the calendar's own local date). */
  holidays: string[];
  /** Business hours, local time, [startHour, endHour). */
  startHour: number;
  endHour: number;
  /** Local timezone offset from UTC, in milliseconds (IST by default). */
  offsetMs: number;
}

export const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Monday-Friday, 09:00-18:00 IST, no holidays — what these rules used before P09, and the fallback until the real calendar loads. */
export const DEFAULT_WORKING_CALENDAR: WorkingCalendar = {
  weekendDays: [0, 6],
  holidays: [],
  startHour: 9,
  endHour: 18,
  offsetMs: IST_OFFSET_MS,
};

/** "0,6" -> [0, 6]; ignores anything that isn't a weekday number. */
export function parseWeekendDays(csv: string): number[] {
  return [...new Set(csv.split(",").map((part) => Number(part.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isoOfUtcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Is this "YYYY-MM-DD" date (or UTC-midnight epoch) a working day? */
export function isWorkingDay(date: string | number, calendar: WorkingCalendar): boolean {
  const ms = typeof date === "number" ? date : Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms)) return false;
  return !calendar.weekendDays.includes(new Date(ms).getUTCDay()) && !calendar.holidays.includes(isoOfUtcDay(ms));
}

/** Local calendar day ("YYYY-MM-DD") of an instant. */
export function localDate(instant: Date, calendar: WorkingCalendar): string {
  return isoOfUtcDay(instant.getTime() + calendar.offsetMs);
}

/**
 * Working days after today (local) up to and including `targetDate`
 * ("YYYY-MM-DD"). Today itself never counts; past/same-day dates give 0.
 */
export function workingDaysBetween(targetDate: string, from: Date, calendar: WorkingCalendar, maxDays = 800): number {
  const targetMs = Date.parse(`${targetDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(targetMs)) return 0;
  const startMs = Date.parse(`${localDate(from, calendar)}T00:00:00Z`);
  let count = 0;
  for (let cursor = startMs + DAY_MS, i = 0; cursor <= targetMs && i < maxDays; cursor += DAY_MS, i++) {
    if (isWorkingDay(cursor, calendar)) count++;
  }
  return count;
}

/**
 * Working HOURS between `from` and the start (local midnight) of
 * `targetDate` — business hours on working days only, the partial current
 * day included.
 */
export function workingHoursBetween(targetDate: string, from: Date, calendar: WorkingCalendar, maxDays = 800): number {
  const targetMs = Date.parse(`${targetDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(targetMs)) return 0;
  const shifted = new Date(from.getTime() + calendar.offsetMs);
  let dayStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  let hourOfDay = shifted.getUTCHours() + shifted.getUTCMinutes() / 60;
  let hours = 0;
  for (let i = 0; i < maxDays && dayStart < targetMs; i++) {
    if (isWorkingDay(dayStart, calendar)) {
      hours += Math.max(0, calendar.endHour - Math.max(hourOfDay, calendar.startHour));
    }
    dayStart += DAY_MS;
    hourOfDay = 0;
  }
  return Math.floor(hours);
}

/** The next working day strictly after `date` ("YYYY-MM-DD"). */
export function nextWorkingDay(date: string, calendar: WorkingCalendar): string {
  let ms = Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + DAY_MS;
  for (let i = 0; i < 60 && !isWorkingDay(ms, calendar); i++) ms += DAY_MS;
  return isoOfUtcDay(ms);
}
