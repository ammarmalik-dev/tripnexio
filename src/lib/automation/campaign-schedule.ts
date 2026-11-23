/**
 * Client doc 16 Nov (N5–N8, N10) — which offer / reminder of a campaign is due on a local day. Pure (ISO dates
 * "YYYY-MM-DD"), so it is unit-tested; the jobs add the local send hour and the once-only dedupe.
 */

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Days from `from` to `to` (both ISO dates); positive when `to` is later. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

/**
 * N5 — OTB offer: the 1st the day after the visa / ticket was delivered, the 2nd two days before travel (one day
 * before when the trip is that close). Never on or after the travel day. Returns the offer number or null.
 */
export function otbOfferDue(today: string, deliveredOn: string, travelDate: string | null): 1 | 2 | null {
  if (travelDate && daysBetween(today, travelDate) <= 0) return null;
  if (today === addDays(deliveredOn, 1)) return 1;
  if (!travelDate) return null;
  const second = daysBetween(addDays(deliveredOn, 1), travelDate) > 2 ? addDays(travelDate, -2) : addDays(travelDate, -1);
  return today === second && second !== addDays(deliveredOn, 1) ? 2 : null;
}

/** N8 — Return Ticket offer: 3 days, then 1 day before travel. */
export function returnTicketOfferDue(today: string, travelDate: string): 1 | 2 | null {
  const days = daysBetween(today, travelDate);
  return days === 3 ? 1 : days === 1 ? 2 : null;
}

/** N7 — Visa Extension offer after a Visa Change approval: day 50, 55 and 60. */
export const VISA_EXTENSION_UPSELL_DAYS = [50, 55, 60] as const;
export function visaExtensionUpsellDue(today: string, approvedOn: string): number | null {
  const day = daysBetween(approvedOn, today);
  return (VISA_EXTENSION_UPSELL_DAYS as readonly number[]).includes(day) ? day : null;
}

/** N10 — Flight → New Visa and New Visa → Flight: two offers before departure, one of them 2 days before. */
export const CROSS_UPSELL_DAYS_BEFORE = [5, 2] as const;
export function crossUpsellDue(today: string, travelDate: string): number | null {
  const days = daysBetween(today, travelDate);
  return (CROSS_UPSELL_DAYS_BEFORE as readonly number[]).includes(days) ? days : null;
}

/** N6 — UAE visa: a 30-day visa on day 20 / 25 / 30, a 60-day visa on day 50 / 55 / 60 from travel. */
export function uaeVisaReminderDue(today: string, travelDate: string, stayDays: number | null): number | null {
  const offsets = stayDays === 30 ? [20, 25, 30] : stayDays === 60 ? [50, 55, 60] : [];
  const day = daysBetween(travelDate, today);
  return offsets.includes(day) ? day : null;
}

/** N6 — after an extension application: day 25 and 29 from the application date. */
export function afterExtensionReminderDue(today: string, appliedOn: string): number | null {
  const day = daysBetween(appliedOn, today);
  return day === 25 || day === 29 ? day : null;
}
