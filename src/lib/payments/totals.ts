import type { Payment } from "../../generated/prisma/client";

type PaymentAmounts = Pick<Payment, "amount" | "gstAmount" | "gatewayFee" | "couponDiscount">;

/** Customer-payable total in rupees — the same formula create-payment.ts uses: (amount − couponDiscount) + GST + gateway fee, rounded to paise. */
export function paymentTotal(payment: PaymentAmounts): number {
  const net = Math.max(0, Number(payment.amount) - Number(payment.couponDiscount ?? 0));
  return Math.round((net + Number(payment.gstAmount) + Number(payment.gatewayFee)) * 100) / 100;
}

/** paymentTotal() in paise — what the gateway is asked to collect (see RazorpayGateway.createPaymentLink). */
export function paymentTotalInPaise(payment: PaymentAmounts): number {
  return Math.round(paymentTotal(payment) * 100);
}
