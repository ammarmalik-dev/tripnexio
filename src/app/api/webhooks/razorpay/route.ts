import crypto from "crypto";
import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { isPlaceholder } from "@/lib/env-placeholder";
import { getPaymentGateway, PaymentGatewayConfigError } from "@/lib/payments/get-gateway";
import { completePaymentSuccess, failPayment } from "@/lib/payments/complete-payment";
import { notifyPaymentReceived } from "@/lib/payments/notify-payment-received";
import { paymentTotalInPaise } from "@/lib/payments/totals";
import { assertQuotationPayable } from "@/lib/payments/quotation-payable";
import type { Prisma } from "@/generated/prisma/client";

const EXPECTED_CURRENCY = "INR";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * Public route — no staff session exists here, Razorpay calls this directly.
 * Authenticity comes entirely from the HMAC signature check inside
 * gateway.verifyAndParseWebhook(), never from a permission/session check.
 * Reads the raw text body (not request.json()) because signature
 * verification needs the exact bytes Razorpay signed.
 *
 * Every processed event is recorded in PaymentWebhookEvent inside the same
 * transaction as its effect, so a redelivered event (same event id) is
 * acknowledged without being applied twice. A success event only completes
 * the payment when the gateway's amount and currency match the Payment total
 * and the quotation it was priced from is still valid.
 */
export async function POST(request: NextRequest) {
  if (isPlaceholder(process.env.RAZORPAY_WEBHOOK_SECRET)) {
    return jsonError(503, "Payment webhook is not configured.");
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  let gateway;
  try {
    gateway = getPaymentGateway();
  } catch (error) {
    if (error instanceof PaymentGatewayConfigError) return jsonError(503, "Payment webhook is not configured.");
    throw error;
  }

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

  const eventId =
    request.headers.get("x-razorpay-event-id") ?? event.eventId ?? `sha256:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
  const providerName = gateway.providerName;
  const actor = { actorLabel: `via ${providerName} webhook (${event.rawEventName}${event.gatewayPaymentId ? `, gateway payment ${event.gatewayPaymentId}` : ""})` };

  const recordEvent = (tx: Prisma.TransactionClient, outcome: string) =>
    tx.paymentWebhookEvent.create({
      data: { id: eventId, provider: providerName, eventName: event.rawEventName, gatewayRef: event.gatewayRef, outcome },
    });

  try {
    if (event.type === "PAYMENT_SUCCESS") {
      const expectedPaise = paymentTotalInPaise(payment);
      const reportedCurrency = event.currency?.toUpperCase() ?? null;
      if (event.amountInPaise !== expectedPaise || reportedCurrency !== EXPECTED_CURRENCY) {
        await db.$transaction(async (tx) => {
          await recordEvent(tx, "AMOUNT_MISMATCH");
          await writeAudit(tx, {
            entityType: "Payment",
            entityId: payment.id,
            action: "PAYMENT_AMOUNT_MISMATCH",
            note: `Gateway reported ${event.amountInPaise ?? "no amount"} paise ${reportedCurrency ?? "no currency"}; expected ${expectedPaise} paise ${EXPECTED_CURRENCY}. Payment not completed (${actor.actorLabel})`,
          });
        });
        return jsonSuccess({ received: true, matched: true, completed: false });
      }

      const notPayable = payment.status === "PENDING" ? await assertQuotationPayable(payment) : null;
      if (notPayable) {
        await db.$transaction(async (tx) => {
          await recordEvent(tx, "QUOTE_EXPIRED");
          await writeAudit(tx, {
            entityType: "Payment",
            entityId: payment.id,
            action: "PAYMENT_BLOCKED_QUOTE_EXPIRED",
            note: `Gateway reported a successful payment after the quotation expired; payment left PENDING for staff review (${actor.actorLabel})`,
          });
        });
        return jsonSuccess({ received: true, matched: true, completed: false });
      }

      const result = await db.$transaction(async (tx) => {
        await recordEvent(tx, "COMPLETED");
        return completePaymentSuccess(tx, payment, actor);
      });
      if (result.didTransition) {
        await notifyPaymentReceived(result.payment.id);
      }
    } else {
      await db.$transaction(async (tx) => {
        await recordEvent(tx, "FAILED");
        await failPayment(tx, payment, "FAILED", actor);
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonSuccess({ received: true, matched: true, duplicate: true });
    }
    throw error;
  }

  return jsonSuccess({ received: true, matched: true });
}
