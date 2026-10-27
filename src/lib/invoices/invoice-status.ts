/**
 * Client doc 2026-10-15 (G2) / 2026-10-20 (F1) / 2026-10-27 (F1) — the one status an issued invoice carries, shared by
 * the invoice PDF stamp and the "Scan to verify" page so they can never disagree:
 * - Refunded once completed refunds cover the amount paid (gateway fee excluded) or the booking is cancelled,
 *   Partially Refunded for less;
 * - Cancelled when the booking was cancelled (coarse CANCELLED / REFUNDED, a "…Cancelled…" service status other than
 *   Partially Cancelled, a rejected / unable-to-process status mapped to CANCELLED) or a full refund is under way;
 * - otherwise Paid.
 */
export type InvoiceSettlementStatus = "Paid" | "Cancelled" | "Refunded" | "Partially Refunded";

export interface InvoiceStatusInput {
  /** What the customer paid: amount − coupon + GST + gateway fee. */
  paidTotal: number;
  gatewayFee: number;
  bookingStatus: string;
  /** The booking's current per-service status (null = none). */
  serviceStatus: { name: string; mapsToBookingStatus?: string | null } | null;
  refunds: { status: string; refundAmount: number }[];
}

const CANCELLED_BOOKING = new Set(["CANCELLED", "REFUNDED"]);

export function bookingIsCancelled(input: Pick<InvoiceStatusInput, "bookingStatus" | "serviceStatus">): boolean {
  if (CANCELLED_BOOKING.has(input.bookingStatus)) return true;
  const status = input.serviceStatus;
  if (!status) return false;
  if (status.mapsToBookingStatus && CANCELLED_BOOKING.has(status.mapsToBookingStatus)) return true;
  return /\bcancel+ed\b/i.test(status.name) && !/partial/i.test(status.name);
}

export function invoiceSettlementStatus(input: InvoiceStatusInput): InvoiceSettlementStatus {
  const round2 = (value: number) => Math.round(value * 100) / 100;
  const refundable = round2(Math.max(0, input.paidTotal - input.gatewayFee));
  const completed = round2(input.refunds.filter((refund) => refund.status === "COMPLETED").reduce((sum, refund) => sum + refund.refundAmount, 0));
  const inProgress = round2(
    input.refunds.filter((refund) => refund.status === "PENDING" || refund.status === "PROCESSING").reduce((sum, refund) => sum + refund.refundAmount, 0)
  );
  const cancelled = bookingIsCancelled(input);
  if (completed > 0) return completed + 0.01 >= refundable || cancelled ? "Refunded" : "Partially Refunded";
  if (cancelled) return "Cancelled";
  // A full refund raised / at the gateway: the sale is being cancelled — never shown as Paid any more.
  if (refundable > 0 && inProgress + 0.01 >= refundable) return "Cancelled";
  return "Paid";
}
