import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { webhookGateways } from "@/lib/payments/accounts";
import { processGatewayWebhookEvent } from "@/lib/payments/process-webhook-event";
import type { GatewayWebhookEvent } from "@/lib/payments/gateway";

/**
 * Client corrections 2026-10-05 §27 — Cashfree payment-link webhooks
 * (failover gateway). Public route: authenticity comes only from the
 * signature (x-webhook-signature over x-webhook-timestamp + raw body, checked
 * against each configured Cashfree account). Events go through the same
 * idempotent pipeline as Razorpay.
 */
export async function POST(request: NextRequest) {
  const gateways = await webhookGateways("CASHFREE");
  if (gateways.length === 0) return jsonError(503, "Payment webhook is not configured.");

  const rawBody = await request.text();
  const timestamp = request.headers.get("x-webhook-timestamp");
  const signature = request.headers.get("x-webhook-signature");
  const combined = timestamp && signature ? `${timestamp}.${signature}` : null;

  let event: GatewayWebhookEvent | null = null;
  for (const gateway of gateways) {
    event = gateway.verifyAndParseWebhook(rawBody, combined);
    if (event) break;
  }
  if (!event) return jsonError(400, "Invalid webhook payload or signature.");

  const outcome = await processGatewayWebhookEvent({
    event,
    providerName: "cashfree",
    providerEventId: request.headers.get("x-idempotency-key"),
    rawBody,
  });
  return jsonSuccess({ received: true, ...outcome });
}
