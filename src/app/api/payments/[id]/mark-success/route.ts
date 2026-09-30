import type { NextRequest } from "next/server";
import { markPaymentSuccessSchema } from "@/lib/validation/payment-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { completePaymentSuccess } from "@/lib/payments/complete-payment";
import { notifyPaymentReceived } from "@/lib/payments/notify-payment-received";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Manual staff override for the gateway webhook (see
 * /api/webhooks/razorpay) — e.g. a customer paid by bank transfer, or the
 * webhook genuinely never arrived. Both paths share the exact same
 * transition logic (completePaymentSuccess).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown = {};
  const rawBody = await request.text();
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError(400, "Invalid request body.");
    }
  }

  const parsed = markPaymentSuccessSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  // Business Rules §14 — a manual payment override is a financial adjustment; only this staff route needs the reason, not the webhook path that shares completePaymentSuccess().
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  const payment = await db.payment.findUnique({
    where: { id },
    include: { booking: { include: { lead: true } } },
  });
  if (!payment) return jsonError(404, "Payment not found.");
  const scopeError = assertServiceAccess(session, payment.booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (payment.status !== "PENDING") {
    return jsonError(409, `This payment is already ${payment.status.toLowerCase()}.`);
  }
  if (payment.method === "BANK_TRANSFER") {
    return jsonError(409, "Bank transfer payments must be confirmed with Approve Bank Transfer (needs payments.approve and an uploaded slip).");
  }

  const result = await db.$transaction((tx) =>
    completePaymentSuccess(
      tx,
      payment,
      { byUserId: session.id, actorLabel: withReason(`manual override by ${session.name} — no gateway webhook received`, reason) },
      { gatewayRef: parsed.data.gatewayRef ?? payment.gatewayRef ?? `MANUAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}` }
    )
  );

  if (result.didTransition) {
    await notifyPaymentReceived(result.payment.id, result.statusNotifications);
  }

  return jsonSuccess(result);
}
