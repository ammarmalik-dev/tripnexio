import type { NextRequest } from "next/server";
import { markPaymentSuccessSchema } from "@/lib/validation/payment-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { completePaymentSuccess } from "@/lib/payments/complete-payment";
import { notifyPaymentReceived } from "@/lib/payments/notify-payment-received";

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

  const result = await db.$transaction((tx) =>
    completePaymentSuccess(
      tx,
      payment,
      { byUserId: session.id, actorLabel: `manual override by ${session.name} — no gateway webhook received` },
      { gatewayRef: parsed.data.gatewayRef ?? payment.gatewayRef ?? `MANUAL-${crypto.randomUUID().slice(0, 8).toUpperCase()}` }
    )
  );

  if (result.didTransition) {
    await notifyPaymentReceived(result.payment.id);
  }

  return jsonSuccess(result);
}
