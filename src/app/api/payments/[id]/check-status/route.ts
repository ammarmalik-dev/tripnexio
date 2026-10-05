import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { getPaymentGateway, PaymentGatewayConfigError } from "@/lib/payments/get-gateway";
import { completePaymentSuccess } from "@/lib/payments/complete-payment";
import { notifyPaymentReceived } from "@/lib/payments/notify-payment-received";
import { paymentTotalInPaise } from "@/lib/payments/totals";
import { assertQuotationPayable } from "@/lib/payments/quotation-payable";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const EXPECTED_CURRENCY = "INR";

/**
 * Client corrections 2026-10-05: an online payment's success is fetched from
 * the gateway, never marked by hand. This replaces the old manual
 * "Mark Success": staff ask the gateway for the link's state (for when a
 * webhook was missed) and the payment completes only if the gateway says it
 * is paid in full, with the same amount/currency and quotation checks as
 * the webhook (/api/webhooks/razorpay).
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  try {
    const payment = await db.payment.findUnique({ where: { id }, include: { booking: { include: { lead: true } } } });
    if (!payment) return jsonError(404, "Payment not found.");
    const scopeError = assertServiceAccess(session, payment.booking.lead.serviceType);
    if (scopeError) return scopeError;
    if (payment.method !== "GATEWAY" || !payment.gatewayRef) {
      return jsonError(409, "Only an online payment link can be checked with the gateway.");
    }
    if (payment.status !== "PENDING") {
      return jsonSuccess({ outcome: "ALREADY_FINAL", status: payment.status });
    }

    const gateway = getPaymentGateway();
    const linkStatus = await gateway.fetchPaymentLinkStatus(payment.gatewayRef);
    if (!linkStatus.paid) {
      return jsonSuccess({ outcome: "NOT_PAID", status: payment.status });
    }

    const expectedPaise = paymentTotalInPaise(payment);
    const currency = linkStatus.currency?.toUpperCase() ?? null;
    if (linkStatus.amountInPaise !== expectedPaise || currency !== EXPECTED_CURRENCY) {
      await db.$transaction((tx) =>
        writeAudit(tx, {
          entityType: "Payment",
          entityId: payment.id,
          action: "PAYMENT_AMOUNT_MISMATCH",
          byUserId: session.id,
          note: `Gateway reports ${linkStatus.amountInPaise ?? "no amount"} paise ${currency ?? "no currency"}; expected ${expectedPaise} paise ${EXPECTED_CURRENCY}. Payment not completed (status check by ${session.name})`,
        })
      );
      return jsonError(409, "The gateway's paid amount doesn't match this payment. It was not completed; please check it in the gateway dashboard.");
    }

    const notPayable = await assertQuotationPayable(payment);
    if (notPayable) return jsonError(409, notPayable);

    const result = await db.$transaction((tx) =>
      completePaymentSuccess(tx, payment, {
        byUserId: session.id,
        actorLabel: `confirmed paid by ${gateway.providerName} on a status check by ${session.name}${linkStatus.gatewayPaymentId ? `, gateway payment ${linkStatus.gatewayPaymentId}` : ""}`,
      })
    );
    if (result.didTransition) {
      await notifyPaymentReceived(result.payment.id, result.statusNotifications);
    }
    return jsonSuccess({ outcome: "COMPLETED", status: result.payment.status });
  } catch (error) {
    if (error instanceof PaymentGatewayConfigError) return jsonError(503, "The payment gateway isn't configured.");
    console.error("[api/payments/check-status] failed", error);
    return jsonError(500, "Couldn't check the payment with the gateway. Please try again.");
  }
}
