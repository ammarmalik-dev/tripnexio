import crypto from "crypto";
import { db } from "../db";
import { writeAudit } from "../audit/log";
import { completePaymentSuccess, failPayment } from "./complete-payment";
import { notifyPaymentReceived } from "./notify-payment-received";
import { paymentTotalInPaise } from "./totals";
import { assertQuotationPayable } from "./quotation-payable";
import type { GatewayWebhookEvent } from "./gateway";
import type { Prisma } from "../../generated/prisma/client";

const EXPECTED_CURRENCY = "INR";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

export type WebhookOutcome = { matched: false } | { matched: true; completed?: boolean; duplicate?: boolean };

/**
 * Applies one verified gateway webhook event (shared by the Razorpay and
 * Cashfree webhook routes). Every processed event is recorded in
 * PaymentWebhookEvent inside the same transaction as its effect, so a
 * redelivered event is acknowledged without being applied twice. A success
 * event only completes the payment when the gateway's amount and currency
 * match the Payment total and the quotation it was priced from is still valid.
 */
export async function processGatewayWebhookEvent(input: {
  event: GatewayWebhookEvent;
  providerName: string;
  /** The provider's own event id when it sends one (header); else derived from the payload. */
  providerEventId: string | null;
  rawBody: string;
}): Promise<WebhookOutcome> {
  const { event, providerName, rawBody } = input;
  const payment = await db.payment.findUnique({
    where: { gatewayRef: event.gatewayRef },
    include: { booking: { include: { lead: true } } },
  });
  // Not an error on our side — could be a link this app didn't create, or already cleaned up.
  if (!payment) return { matched: false };

  const eventId = input.providerEventId ?? event.eventId ?? `sha256:${crypto.createHash("sha256").update(rawBody).digest("hex")}`;
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
        return { matched: true, completed: false };
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
        return { matched: true, completed: false };
      }

      const result = await db.$transaction(async (tx) => {
        await recordEvent(tx, "COMPLETED");
        return completePaymentSuccess(tx, payment, actor);
      });
      if (result.didTransition) {
        await notifyPaymentReceived(result.payment.id, result.statusNotifications);
      }
    } else {
      await db.$transaction(async (tx) => {
        await recordEvent(tx, "FAILED");
        await failPayment(tx, payment, "FAILED", actor);
      });
    }
  } catch (error) {
    if (isUniqueViolation(error)) return { matched: true, duplicate: true };
    throw error;
  }
  return { matched: true };
}
