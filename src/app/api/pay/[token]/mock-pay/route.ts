import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getPaymentGateway } from "@/lib/payments/get-gateway";
import { completePaymentSuccess } from "@/lib/payments/complete-payment";
import { notifyPaymentReceived } from "@/lib/payments/notify-payment-received";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * Demo-only "Pay now": completes the pending payment exactly like the real
 * gateway webhook does (same completePaymentSuccess + payment-received
 * notification). Refuses outright unless the mock gateway is the active one —
 * once real Razorpay keys are configured, payments only complete through
 * Razorpay's signed webhook.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  if (getPaymentGateway().providerName !== "mock") {
    return jsonError(403, "Demo payments are only available while the payment gateway isn't connected.");
  }

  const { token } = await params;
  if (!/^[a-f0-9]{32}$/.test(token)) return jsonError(404, "Payment page not found.");

  const payment = await db.payment.findFirst({
    where: { booking: { customerToken: token } },
    orderBy: { createdAt: "desc" },
    include: { booking: { include: { lead: true } } },
  });
  if (!payment) return jsonError(404, "Payment page not found.");
  if (payment.status !== "PENDING") {
    return jsonError(409, `This payment is already ${payment.status.toLowerCase()}.`);
  }

  const result = await db.$transaction((tx) =>
    completePaymentSuccess(tx, payment, { actorLabel: "demo payment (payment gateway not connected yet)" }, {
      gatewayRef: payment.gatewayRef ?? undefined,
    })
  );
  if (result.didTransition) await notifyPaymentReceived(result.payment.id);

  return jsonSuccess({ status: result.payment.status });
}
