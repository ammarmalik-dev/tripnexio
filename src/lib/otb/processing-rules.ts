import {
  DEFAULT_WORKING_CALENDAR,
  isWorkingDay,
  localDate,
  workingDaysBetween,
  workingHoursBetween,
  type WorkingCalendar,
} from "../calendar/working-calendar";

/** Locked rule (OTB.md §7): Normal OTB = T+2 working days (Admin can change it per airline or globally via OtbRuleConfig). */
export const DEFAULT_STANDARD_PROCESSING_WORKING_DAYS = 2;
/** Client answer (2026-09-23): Urgent OTB processing is 8 working *hours* (Admin can change it, per airline). */
export const DEFAULT_URGENT_PROCESSING_WORKING_HOURS = 8;

export type OtbProcessingType = "normal" | "urgent";

/**
 * Client reply 2026-10-14 — same-day OTB: "on working days we can accept till
 * 4 PM if travel is after 8 hrs; if the TAT is set to more than 8 hrs, don't
 * accept same day". Times are local (the working calendar's timezone).
 */
export const OTB_SAME_DAY_CUTOFF_HOUR = 16;
export const OTB_SAME_DAY_MAX_URGENT_HOURS = 8;

/**
 * The client's same-day rule: today is a working day, it's no later than 4 PM,
 * the urgent TAT is at most 8 hours, and the flight leaves at least that many
 * hours from now. Needs the departure time.
 */
export function sameDayOtbAllowed(
  travelDate: string,
  departureTime: string | null | undefined,
  urgentHours: number | null,
  from: Date,
  calendar: WorkingCalendar,
): boolean {
  const hours = urgentHours ?? DEFAULT_URGENT_PROCESSING_WORKING_HOURS;
  if (hours > OTB_SAME_DAY_MAX_URGENT_HOURS) return false;
  const match = departureTime?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const today = localDate(from, calendar);
  if (travelDate.slice(0, 10) !== today || !isWorkingDay(today, calendar))
    return false;
  const local = new Date(from.getTime() + calendar.offsetMs);
  const nowHour = local.getUTCHours() + local.getUTCMinutes() / 60;
  if (nowHour > OTB_SAME_DAY_CUTOFF_HOUR) return false;
  const departure =
    Date.parse(`${today}T${match[1].padStart(2, "0")}:${match[2]}:00Z`) -
    calendar.offsetMs;
  return departure - from.getTime() >= hours * 60 * 60 * 1000;
}

export interface OtbAirlineRules {
  /** Working days a normal OTB needs before travel. */
  standardDays: number;
  /** Working HOURS an urgent OTB needs; null = no minimum has been configured yet (defaults to the 8-hour client answer, see get-otb-rules.ts). */
  urgentHours: number | null;
  /** An airline offers Urgent only if Admin has set an urgent price for it. */
  urgentAvailable: boolean;
}

export interface OtbTravelDateOutcome {
  status: "OK" | "URGENT_ONLY" | "BLOCKED";
  allowed: OtbProcessingType[];
  /** Customer-facing explanation; null when nothing needs saying. */
  message: string | null;
  workingDays: number;
  workingHours: number;
}

/**
 * P09 — working days/hours come from the shared working calendar (weekend
 * days per country, public holidays and business hours, all Admin-
 * configured) instead of a fixed Monday-Friday rule. OTB work is done by
 * the India team, so callers pass the INDIA calendar; the default is the
 * pre-P09 Monday-Friday 09:00-18:00 IST calendar, used by the form preview
 * until the real one has loaded.
 */
export function workingDaysUntil(
  travelDate: string,
  from: Date = new Date(),
  calendar: WorkingCalendar = DEFAULT_WORKING_CALENDAR,
): number {
  return workingDaysBetween(travelDate, from, calendar);
}

/**
 * Working HOURS between `from` and the departure: the START of `travelDate`
 * (local midnight) when no departure time is known — the conservative cutoff
 * — else that local time on the travel day (client doc 2026-10-14: same-day
 * travel can be Express when the 8 working hours finish before the flight).
 */
export function workingHoursUntil(
  travelDate: string,
  from: Date = new Date(),
  calendar: WorkingCalendar = DEFAULT_WORKING_CALENDAR,
  departureTime?: string | null,
): number {
  const match = departureTime?.match(/^(\d{1,2}):(\d{2})$/);
  const hour = match
    ? Math.min(24, Number(match[1]) + Number(match[2]) / 60)
    : 0;
  return workingHoursBetween(travelDate, from, calendar, 800, hour);
}

/**
 * Client rule: if the travel date falls inside the standard processing
 * timeline (days), suggest Urgent when the airline offers it AND enough
 * working hours remain for Urgent's own (hour-level) turnaround; if
 * neither fits, tell the customer and stop the booking. Shared by the form
 * (to guide the customer) and the API (the real enforcement).
 */
export function evaluateOtbTravelDate(
  travelDate: string,
  rules: OtbAirlineRules,
  from: Date = new Date(),
  calendar: WorkingCalendar = DEFAULT_WORKING_CALENDAR,
  /** "HH:mm" local departure time, when the customer gave it. */
  departureTime?: string | null,
): OtbTravelDateOutcome {
  const workingDays = workingDaysUntil(travelDate, from, calendar);
  const workingHours = workingHoursUntil(
    travelDate,
    from,
    calendar,
    departureTime,
  );

  if (workingDays >= rules.standardDays) {
    return {
      status: "OK",
      allowed: rules.urgentAvailable ? ["normal", "urgent"] : ["normal"],
      message: null,
      workingDays,
      workingHours,
    };
  }

  const within = `Your travel date is within the standard ${rules.standardDays} working-day OTB processing time.`;

  // Same-day travel follows the client's own rule (4 PM cut-off, flight at least the TAT later); other dates the working-hour TAT.
  const sameDay = travelDate.slice(0, 10) === localDate(from, calendar);
  const urgentFits = sameDay
    ? sameDayOtbAllowed(
        travelDate,
        departureTime,
        rules.urgentHours,
        from,
        calendar,
      )
    : rules.urgentHours === null || workingHours >= rules.urgentHours;
  if (rules.urgentAvailable && urgentFits) {
    return {
      status: "URGENT_ONLY",
      allowed: ["urgent"],
      message: `${within} Urgent processing is available for this airline — please choose Urgent.`,
      workingDays,
      workingHours,
    };
  }

  const reason = !rules.urgentAvailable
    ? "Urgent processing isn't available for this airline."
    : sameDay &&
        (rules.urgentHours ?? DEFAULT_URGENT_PROCESSING_WORKING_HOURS) >
          OTB_SAME_DAY_MAX_URGENT_HOURS
      ? "Same-day OTB isn't available for this airline."
      : sameDay
        ? `Same-day OTB is accepted on working days until ${OTB_SAME_DAY_CUTOFF_HOUR - 12}:00 PM, for flights at least ${rules.urgentHours ?? DEFAULT_URGENT_PROCESSING_WORKING_HOURS} hours later${departureTime ? "" : " — add your flight's departure time"}.`
        : `Even urgent processing needs at least ${rules.urgentHours} working hours before departure for this airline${departureTime ? "" : " (add your flight's departure time if you travel soon)"}.`;

  return {
    status: "BLOCKED",
    allowed: [],
    message: `${within} ${reason} Please choose a later travel date or contact our team on WhatsApp.`,
    workingDays,
    workingHours,
  };
}

/**
 * Client corrections 2026-10-05 — the earliest travel dates the airline's TAT
 * can still meet: Normal (standard working days) and, when the airline offers
 * it, Urgent. Walks forward day by day with the same rule the form and the
 * server apply (evaluateOtbTravelDate). Dates are "YYYY-MM-DD".
 */
export function earliestOtbTravelDates(
  rules: OtbAirlineRules,
  from: Date = new Date(),
  calendar: WorkingCalendar = DEFAULT_WORKING_CALENDAR,
): { normal: string | null; urgent: string | null } {
  let normal: string | null = null;
  let urgent: string | null = null;
  const start = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate(),
  );
  for (
    let offset = 0;
    offset <= 120 &&
    (normal === null || (rules.urgentAvailable && urgent === null));
    offset += 1
  ) {
    const iso = new Date(start + offset * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const outcome = evaluateOtbTravelDate(iso, rules, from, calendar);
    if (normal === null && outcome.allowed.includes("normal")) normal = iso;
    if (urgent === null && outcome.allowed.includes("urgent")) urgent = iso;
  }
  return { normal, urgent: rules.urgentAvailable ? urgent : null };
}
