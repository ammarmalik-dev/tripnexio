export type VisaExtensionEligibilityOutcome = "ELIGIBLE" | "URGENT_TODAY" | "NOT_ELIGIBLE";

/** P13 — only these staff verification outcomes may be quoted (and approved). */
export const QUOTABLE_EXTENSION_OUTCOMES: VisaExtensionEligibilityOutcome[] = ["ELIGIBLE", "URGENT_TODAY"];

/** P13 — the customer-facing 30-day extension the quote page states. */
export const EXTENSION_DURATION_DAYS = 30;

export const DAY_MS = 24 * 60 * 60 * 1000;
/** Visa_Extension.md §9: payment for an expires-today case must be done by 6:00 PM on the same working day. */
export const URGENT_DEADLINE_HOUR = 18;

export interface UrgentDeadline {
  /** The working day the 6:00 PM deadline falls on ("YYYY-MM-DD", UAE working calendar). */
  day: string;
  /** The deadline instant, ISO — 18:00 on `day` in the calendar's configured timezone. */
  at: string;
  /** UAE or India holidays on the day after `day` — an extra urgent warning (no processing the next day). */
  nextDayHolidays: { country: "UAE" | "INDIA"; name: string }[];
}

/**
 * Visa_Extension.md §8/§9, staff-verified expiry: expired 30+ days ->
 * NOT_ELIGIBLE (no override), expires today -> URGENT_TODAY, otherwise
 * ELIGIBLE. "Today" is the local day on the UAE working calendar (P09),
 * not the server's own timezone.
 */
export function computeEligibilityOutcome(verifiedExpiryDate: string, today: string): VisaExtensionEligibilityOutcome {
  const expiryMs = Date.parse(`${verifiedExpiryDate.slice(0, 10)}T00:00:00Z`);
  const todayMs = Date.parse(`${today}T00:00:00Z`);
  const daysExpired = Math.round((todayMs - expiryMs) / DAY_MS);
  if (daysExpired >= 30) return "NOT_ELIGIBLE";
  if (daysExpired === 0) return "URGENT_TODAY";
  return "ELIGIBLE";
}

/** Reads the urgency block the verify route stores on Lead.details (null when the case isn't urgent). */
export function urgentDeadlineFromDetails(details: unknown): UrgentDeadline | null {
  const data = (details ?? {}) as Record<string, unknown>;
  if (data.eligibilityOutcome !== "URGENT_TODAY") return null;
  const block = data.urgentDeadline as Partial<UrgentDeadline> | undefined;
  if (!block || typeof block.day !== "string" || typeof block.at !== "string") return null;
  const holidays = Array.isArray(block.nextDayHolidays)
    ? block.nextDayHolidays.filter((h): h is UrgentDeadline["nextDayHolidays"][number] => !!h && typeof h.name === "string" && (h.country === "UAE" || h.country === "INDIA"))
    : [];
  return alignDeadlineToVerifiedExpiry({ day: block.day, at: block.at, nextDayHolidays: holidays }, data.verifiedExpiryDate);
}

/**
 * Client doc 2026-10-27 (D3) — staff verified the expiry as 17 Oct but the customer's quote / payment page said
 * "pay by 6:00 PM on 19 Oct": blocks stored before the 20 Oct rule (D2) rolled a weekend expiry on to the next
 * working day. The deadline is always 6:00 PM on the staff-verified expiry day itself (never the customer's own
 * date), so a stored block whose day differs is moved to it — the same 18:00 local time, shifted by whole days.
 * The holiday warning belonged to the old day, so it is dropped rather than shown against the wrong date.
 */
export function alignDeadlineToVerifiedExpiry(deadline: UrgentDeadline, verifiedExpiryDate: unknown): UrgentDeadline {
  const expiryDay = typeof verifiedExpiryDate === "string" ? verifiedExpiryDate.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expiryDay) || expiryDay === deadline.day) return deadline;
  const shiftMs = Date.parse(`${expiryDay}T00:00:00Z`) - Date.parse(`${deadline.day}T00:00:00Z`);
  const atMs = Date.parse(deadline.at);
  if (Number.isNaN(shiftMs) || Number.isNaN(atMs)) return deadline;
  return { day: expiryDay, at: new Date(atMs + shiftMs).toISOString(), nextDayHolidays: [] };
}

/**
 * P13 — a Visa Extension lead may only be quoted (or its quote approved)
 * once staff verified the expiry and the outcome is ELIGIBLE or
 * URGENT_TODAY. Returns the refusal message, or null when allowed.
 */
export function extensionQuoteBlockReason(serviceType: string, details: unknown): string | null {
  if (serviceType !== "VISA_EXTENSION") return null;
  const outcome = ((details ?? {}) as Record<string, unknown>).eligibilityOutcome;
  if (outcome === undefined || outcome === null) return "Verify the visa expiry (Staff Visa Verification) before quoting this extension.";
  if (!QUOTABLE_EXTENSION_OUTCOMES.includes(outcome as VisaExtensionEligibilityOutcome)) {
    return "This extension was verified Not Eligible, so it can't be quoted.";
  }
  return null;
}

export function formatDeadlineDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
