import { localDateOf } from "./settings";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
/** Client doc 16 Nov (N3) — scheduled every 5 minutes; small tolerances absorb the scheduler's own jitter. */
const SAME_DAY_SERVICES = new Set(["VISA_CHANGE", "VISA_EXTENSION"]);
const SAME_DAY_CUTOFF_HOUR = 18;

/**
 * N3 — the cooldown before the next payment reminder, or null when none is due:
 * - Flight Special Fare: 10 and 20 minutes after the payment link (the quotation is valid for 30 minutes);
 * - Visa Change / Visa Extension: every 2 hours after it, until 6:00 PM the same (local) day only;
 * - New Visa / OTB / Return Ticket (and an extra payment): once a day, from 2 hours after it.
 */
export function reminderCooldownMs(input: { serviceType: string; purpose: string; createdAt: Date; now: number; clock: { date: string; hour: number; offsetMs: number } }): number | null {
  const elapsed = input.now - input.createdAt.getTime();
  if (input.purpose !== "EXTRA" && input.serviceType === "FLIGHT_SPECIAL_FARE") {
    return elapsed >= 10 * MINUTE_MS && elapsed < 30 * MINUTE_MS ? 9 * MINUTE_MS : null;
  }
  if (input.purpose !== "EXTRA" && SAME_DAY_SERVICES.has(input.serviceType)) {
    if (localDateOf(input.createdAt, input.clock.offsetMs) !== input.clock.date || input.clock.hour >= SAME_DAY_CUTOFF_HOUR) return null;
    return elapsed >= 2 * HOUR_MS - 5 * MINUTE_MS ? 2 * HOUR_MS - 5 * MINUTE_MS : null;
  }
  return elapsed >= 2 * HOUR_MS ? 24 * HOUR_MS - 30 * MINUTE_MS : null;
}

/**
 * Called by n8n's "Payment Follow-up Reminders" workflow. Two jobs: (1)
 * a PENDING payment whose gateway link has actually expired
 * (linkExpiresAt in the past) gets marked EXPIRED — a PaymentStatus value
 * that existed in the schema since Phase 5A but nothing ever set it until
 * now, since only a customer paying or a webhook failure moved a payment
 * out of PENDING before this. (2) a still-payable PENDING payment that's
 * sat unpaid for a while gets a one-time PAYMENT_REMINDER nudge.
 */
