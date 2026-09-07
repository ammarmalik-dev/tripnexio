import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { getPaymentGateway } from "@/lib/payments/get-gateway";
import { completePaymentSuccess, failPayment } from "@/lib/payments/complete-payment";
import { notifyPaymentReceived } from "@/lib/payments/notify-payment-received";

/**
 * Public route — no staff session exists here, Razorpay calls this directly.
 * Authenticity comes entirely from the HMAC signature check inside
 * gateway.verifyAndParseWebhook(), never from a permission/session check.
 * Reads the raw text body (not request.json()) because signature
 * verification needs the exact bytes Razorpay signed.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  const gateway = getPaymentGateway();
  const event = gateway.verifyAndParseWebhook(rawBody, signature);
  if (!event) {
    // Deliberately generic — never reveal whether the ref was known or the signature was just wrong.
    return jsonError(400, "Invalid webhook payload or signature.");
  }

  const payment = await db.payment.findUnique({
    where: { gatewayRef: event.gatewayRef },
    include: { booking: { include: { lead: true } } },
  });
  if (!payment) {
    // Not an error on our side — could be a webhook for a payment link this app didn't create, or already cleaned up.
    return jsonSuccess({ received: true, matched: false });
  }

  const actor = { actorLabel: `via ${gateway.providerName} webhook (${event.rawEventName}${event.gatewayPaymentId ? `, gateway payment ${event.gatewayPaymentId}` : ""})` };

  if (event.type === "PAYMENT_SUCCESS") {
    const result = await db.$transaction((tx) => completePaymentSuccess(tx, payment, actor));
    if (result.didTransition) {
      await notifyPaymentReceived(result.payment.id);
    }
  } else {
    await db.$transaction((tx) => failPayment(tx, payment, "FAILED", actor));
  }

  return jsonSuccess({ received: true, matched: true });
}
