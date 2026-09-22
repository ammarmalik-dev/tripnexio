/** Client answer (2026-09-21): the standard OTB processing timeline is 24 working days (Admin can change it). */
export const DEFAULT_STANDARD_PROCESSING_WORKING_DAYS = 24;
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

const MAX_DAYS_TO_COUNT = 800;

/**
 * TripNexio's business hours are India-local (IST, UTC+5:30, no DST) even
 * though every date in this app is otherwise stored/computed in UTC (see
 * feedback_pg_timestamp_local_time_parsing in project memory) — working
 * hours must be evaluated against the actual India business day, not the
 * UTC calendar day, or an 8-hour Urgent window would silently drift by up
 * to 5.5 hours. No timezone library in this project (nothing else needs
 * one) — a fixed offset is correct here since India has a single,
 * unchanging UTC offset year-round.
 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
/** Assumption pending client confirmation — no business-hours window was specified anywhere in the handover docs. */
const WORKING_DAY_START_HOUR_IST = 9;
const WORKING_DAY_END_HOUR_IST = 18;

function toIstShifted(date: Date): Date {
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/** Start-of-day (00:00) of `date`'s IST calendar day, expressed as an epoch value in the same IST-shifted numbering `toIstShifted` produces — only ever compared against other values from this same function/`toIstShifted`, never a real UTC instant. */
function istDayStart(date: Date): number {
  const shifted = toIstShifted(date);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

function utcMidnight(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Working days (Mon-Fri) from after `from` up to and including `travelDate`
 * ("YYYY-MM-DD"). Public holidays aren't modelled — the client hasn't given
 * a holiday calendar. Past/same-day dates give 0.
 */
export function workingDaysUntil(travelDate: string, from: Date = new Date()): number {
  const target = new Date(travelDate);
  if (Number.isNaN(target.getTime())) return 0;
  const targetMs = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const startMs = utcMidnight(from);
  const DAY = 24 * 60 * 60 * 1000;

  let count = 0;
  let cursor = startMs + DAY;
  for (let i = 0; i < MAX_DAYS_TO_COUNT && cursor <= targetMs; i++, cursor += DAY) {
    const weekday = new Date(cursor).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count++;
  }
  return count;
}

/**
 * Working HOURS (Mon-Fri, {@link WORKING_DAY_START_HOUR_IST}-{@link WORKING_DAY_END_HOUR_IST}
 * IST) between `from` and the START of `travelDate` (midnight IST) — no
 * flight time is collected on the OTB form, so the start of the travel day
 * is the conservative cutoff (same "travel is today -> 0 hours available"
 * safety margin `workingDaysUntil` already applies for days). Walks day by
 * day in IST-shifted time so both the partial first day and every full day
 * after it fall out of the same loop body without special-casing.
 */
export function workingHoursUntil(travelDate: string, from: Date = new Date()): number {
  const target = new Date(travelDate);
  if (Number.isNaN(target.getTime())) return 0;
  // Both boundaries go through the identical IST-shift-then-truncate
  // transform, so they compare correctly like-for-like — shifting only one
  // side (or shifting one but not truncating it the same way) silently
  // miscounts the travel day itself as available hours; caught and fixed
  // via a hand-traced example before landing this (see commit message).
  const targetIstDayStartMs = istDayStart(target);

  const DAY = 24 * 60 * 60 * 1000;
  let cursor = toIstShifted(from);
  let hours = 0;

  for (let i = 0; i < MAX_DAYS_TO_COUNT; i++) {
    const cursorIstDayStartMs = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate());
    if (cursorIstDayStartMs >= targetIstDayStartMs) break;

    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const hourOfDay = cursor.getUTCHours();
      const startHour = Math.max(hourOfDay, WORKING_DAY_START_HOUR_IST);
      hours += Math.max(0, WORKING_DAY_END_HOUR_IST - startHour);
    }
    cursor = new Date(cursorIstDayStartMs + DAY);
  }
  return hours;
}

/**
 * Client rule: if the travel date falls inside the standard processing
 * timeline (days), suggest Urgent when the airline offers it AND enough
 * working hours remain for Urgent's own (hour-level) turnaround; if
 * neither fits, tell the customer and stop the booking. Shared by the form
 * (to guide the customer) and the API (the real enforcement).
 */
export function evaluateOtbTravelDate(travelDate: string, rules: OtbAirlineRules, from: Date = new Date()): OtbTravelDateOutcome {
  const workingDays = workingDaysUntil(travelDate, from);
  const workingHours = workingHoursUntil(travelDate, from);

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
