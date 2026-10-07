import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { webhookGateways } from "@/lib/payments/accounts";
import { processGatewayWebhookEvent } from "@/lib/payments/process-webhook-event";
import type { GatewayWebhookEvent } from "@/lib/payments/gateway";

/**
 * Public route — no staff session exists here, Razorpay calls this directly.
 * Authenticity comes entirely from the HMAC signature check, never from a
 * permission/session check. Reads the raw text body (not request.json())
 * because signature verification needs the exact bytes Razorpay signed.
 *
 * Client corrections 2026-10-05 §27 — several Razorpay accounts can be
 * configured (failover); the signature is checked against each account's
 * webhook secret, and the matched event goes through the shared pipeline
 * (idempotent per event, amount + currency checked) in
 * src/lib/payments/process-webhook-event.ts.
 */
export async function POST(request: NextRequest) {
  const gateways = await webhookGateways("RAZORPAY");
  if (gateways.length === 0) return jsonError(503, "Payment webhook is not configured.");

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  let event: GatewayWebhookEvent | null = null;
  let providerName = "razorpay";
  for (const gateway of gateways) {
    event = gateway.verifyAndParseWebhook(rawBody, signature);
    if (event) {
      providerName = gateway.providerName;
      break;
    }
  }
  if (!event) {
    // Deliberately generic — never reveal whether the ref was known or the signature was just wrong.
    return jsonError(400, "Invalid webhook payload or signature.");
  }

  const outcome = await processGatewayWebhookEvent({
    event,
    providerName,
    providerEventId: request.headers.get("x-razorpay-event-id"),
    rawBody,
  });
  return jsonSuccess({ received: true, ...outcome });
}
