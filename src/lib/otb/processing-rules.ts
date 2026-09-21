/** Client answer: the standard OTB processing timeline is 24 working days (Admin can change it). */
export const DEFAULT_STANDARD_PROCESSING_WORKING_DAYS = 24;

export type OtbProcessingType = "normal" | "urgent";

export interface OtbAirlineRules {
  /** Working days a normal OTB needs before travel. */
  standardDays: number;
  /** Working days an urgent OTB needs; null = no minimum has been configured yet. */
  urgentDays: number | null;
  /** An airline offers Urgent only if Admin has set an urgent price for it. */
  urgentAvailable: boolean;
}

export interface OtbTravelDateOutcome {
  status: "OK" | "URGENT_ONLY" | "BLOCKED";
  allowed: OtbProcessingType[];
  /** Customer-facing explanation; null when nothing needs saying. */
  message: string | null;
  workingDays: number;
}

const MAX_DAYS_TO_COUNT = 800;

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
 * Client rule: if the travel date falls inside the standard processing
 * timeline, suggest Urgent when the airline offers it; if Urgent isn't
 * available (or its own timeline can't be met), tell the customer and stop
 * the booking. Shared by the form (to guide the customer) and the API (the
 * real enforcement).
 */
export function evaluateOtbTravelDate(workingDays: number, rules: OtbAirlineRules): OtbTravelDateOutcome {
  if (workingDays >= rules.standardDays) {
    return {
      status: "OK",
      allowed: rules.urgentAvailable ? ["normal", "urgent"] : ["normal"],
      message: null,
      workingDays,
    };
  }

  const within = `Your travel date is within the standard ${rules.standardDays} working-day OTB processing time.`;

  if (rules.urgentAvailable && (rules.urgentDays === null || workingDays >= rules.urgentDays)) {
    return {
      status: "URGENT_ONLY",
      allowed: ["urgent"],
      message: `${within} Urgent processing is available for this airline — please choose Urgent.`,
      workingDays,
    };
  }

  const reason = rules.urgentAvailable
    ? `Even urgent processing needs at least ${rules.urgentDays} working days for this airline.`
    : "Urgent processing isn't available for this airline.";
  return {
    status: "BLOCKED",
    allowed: [],
    message: `${within} ${reason} Please choose a later travel date or contact our team on WhatsApp.`,
    workingDays,
  };
}
