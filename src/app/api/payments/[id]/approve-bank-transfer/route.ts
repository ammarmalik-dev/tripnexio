import type { NextRequest } from "next/server";
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
 * Step 51 — the "required approval process" for a bank-transfer payment:
 * gated by payments.approve (excluded from the default Staff role, same
 * raise-vs-approve split as refunds.approve/staff.leave.approve), distinct
 * from payments.edit which only lets staff create the payment and upload
 * the slip. Requires a slip to already be uploaded — approving evidence
 * that doesn't exist yet isn't a real approval. Reuses the exact same
 * completePaymentSuccess() transition every other payment path already
 * goes through (Payment -> SUCCESS, Booking -> CONFIRMED + real bookingId,
 * Lead -> CONVERTED).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.approve");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  const payment = await db.payment.findUnique({
    where: { id },
    include: { booking: { include: { lead: true } } },
  });
  if (!payment) return jsonError(404, "Payment not found.");
  const scopeError = assertServiceAccess(session, payment.booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (payment.method !== "BANK_TRANSFER") {
    return jsonError(409, "This payment isn't a bank transfer.");
  }
  if (!payment.bankSlipUrl) {
    return jsonError(409, "Upload a bank-transfer slip before approving this payment.");
  }
  if (payment.status !== "PENDING") {
    return jsonError(409, `This payment is already ${payment.status.toLowerCase()}.`);
  }

  const result = await db.$transaction((tx) =>
    completePaymentSuccess(tx, payment, { byUserId: session.id, actorLabel: `bank-transfer approved by ${session.name}` })
  );

  if (result.didTransition) {
    await notifyPaymentReceived(result.payment.id);
  }

  return jsonSuccess(result);
}
