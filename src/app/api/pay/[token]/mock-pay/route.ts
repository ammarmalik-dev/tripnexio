import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { isMockGatewayActive, isProductionRuntime } from "@/lib/payments/get-gateway";
import { completePaymentSuccess } from "@/lib/payments/complete-payment";
import { notifyPaymentReceived } from "@/lib/payments/notify-payment-received";
import { assertQuotationPayable } from "@/lib/payments/quotation-payable";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * Demo-only "Pay now" for local development: completes the pending payment
 * exactly like the real gateway webhook does. Does not exist in production
 * (404), and outside production refuses unless the mock gateway is active.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  if (isProductionRuntime()) return jsonError(404, "Not found.");
  if (!isMockGatewayActive()) {
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

  const notPayable = await assertQuotationPayable(payment);
  if (notPayable) return jsonError(409, notPayable);

  const result = await db.$transaction((tx) =>
    completePaymentSuccess(tx, payment, { actorLabel: "demo payment (payment gateway not connected yet)" }, {
      gatewayRef: payment.gatewayRef ?? undefined,
    })
  );
  if (result.didTransition) await notifyPaymentReceived(result.payment.id);

  return jsonSuccess({ status: result.payment.status });
}
