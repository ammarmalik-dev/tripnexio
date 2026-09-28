import { DEFAULT_WORKING_CALENDAR, workingDaysBetween, workingHoursBetween, type WorkingCalendar } from "../calendar/working-calendar";

/** Locked rule (OTB.md §7): Normal OTB = T+2 working days (Admin can change it per airline or globally via OtbRuleConfig). */
export const DEFAULT_STANDARD_PROCESSING_WORKING_DAYS = 2;
/** Client answer (2026-09-23): Urgent OTB processing is 8 working *hours* (Admin can change it, per airline). */
export const DEFAULT_URGENT_PROCESSING_WORKING_HOURS = 8;

export type OtbProcessingType = "normal" | "urgent";

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
export function workingDaysUntil(travelDate: string, from: Date = new Date(), calendar: WorkingCalendar = DEFAULT_WORKING_CALENDAR): number {
  return workingDaysBetween(travelDate, from, calendar);
}

/**
 * Working HOURS between `from` and the START of `travelDate` (local
 * midnight) — no flight time is collected on the OTB form, so the start of
 * the travel day is the conservative cutoff.
 */
export function workingHoursUntil(travelDate: string, from: Date = new Date(), calendar: WorkingCalendar = DEFAULT_WORKING_CALENDAR): number {
  return workingHoursBetween(travelDate, from, calendar);
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
  calendar: WorkingCalendar = DEFAULT_WORKING_CALENDAR
): OtbTravelDateOutcome {
  const workingDays = workingDaysUntil(travelDate, from, calendar);
  const workingHours = workingHoursUntil(travelDate, from, calendar);

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

  if (rules.urgentAvailable && (rules.urgentHours === null || workingHours >= rules.urgentHours)) {
    return {
      status: "URGENT_ONLY",
      allowed: ["urgent"],
      message: `${within} Urgent processing is available for this airline — please choose Urgent.`,
      workingDays,
      workingHours,
    };
  }

  const reason = rules.urgentAvailable
    ? `Even urgent processing needs at least ${rules.urgentHours} working hours for this airline.`
    : "Urgent processing isn't available for this airline.";
  return {
    status: "BLOCKED",
    allowed: [],
    message: `${within} ${reason} Please choose a later travel date or contact our team on WhatsApp.`,
    workingDays,
    workingHours,
  };
}
