import type { PaymentStatus } from "../../generated/prisma/enums";

/**
 * P21 item 2 — "Payment failed" flag on the CRM Leads list. A lead is
 * flagged when its LATEST booking's LATEST payment "didn't go through":
 * FAILED (gateway/webhook reported failure) or EXPIRED (the payment link
 * lapsed unpaid — set by the payment-followup automation). Both leave the
 * booking unpaid and need the same staff follow-up (resend a link), so
 * they're treated as one case; a later SUCCESS/PENDING payment on that
 * booking clears the flag since it becomes the latest one.
 */
export const PAYMENT_FAILED_STATUSES: PaymentStatus[] = ["FAILED", "EXPIRED"];

interface BookingWithLatestPayment {
  payments: readonly { status: PaymentStatus }[];
}

/** `bookings` must be ordered newest-first and each `payments` newest-first (take: 1 is enough for both). */
export function latestPaymentFailedStatus(bookings: readonly BookingWithLatestPayment[]): PaymentStatus | null {
  const status = bookings[0]?.payments[0]?.status;
  return status && PAYMENT_FAILED_STATUSES.includes(status) ? status : null;
}

/** Prisma `include`/`select` fragment that fetches exactly what latestPaymentFailedStatus() needs. */
export const latestBookingPaymentSelect = {
  orderBy: { createdAt: "desc" },
  take: 1,
  select: { payments: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } } },
} as const;
