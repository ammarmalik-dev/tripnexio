import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { notifyPaymentLinkReady } from "@/lib/payments/notify-payment-link";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Client doc 16 Nov (I3) — "payment link generated from a manual lead is not delivered / not visible": staff can
 * send a pending payment's link to the customer again (email + WhatsApp, the same message as when it was created).
 * Each send is audited; the outcome per channel is audited by notifyCustomer.
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  const ownershipError = await assertOwnsEntity(session, "payment", id);
  if (ownershipError) return ownershipError;

  try {
    const payment = await db.payment.findUnique({
      where: { id },
      select: { id: true, status: true, booking: { select: { customerToken: true, lead: { select: { serviceType: true } } } } },
    });
    if (!payment) return jsonError(404, "Payment not found.");
    const scopeError = assertServiceAccess(session, payment.booking.lead.serviceType);
    if (scopeError) return scopeError;
    const actionError = assertServiceAction(session, payment.booking.lead.serviceType, "PAYMENT");
    if (actionError) return actionError;
    if (payment.status !== "PENDING" || !payment.booking.customerToken) {
      return jsonError(409, "Only a pending payment's link can be sent again.");
    }

    await db.$transaction((tx) =>
      writeAudit(tx, {
        entityType: "Payment",
        entityId: payment.id,
        action: "PAYMENT_LINK_RESENT",
        byUserId: session.id,
        note: `Payment link sent to the customer again (by ${session.name})`,
      })
    );
    await notifyPaymentLinkReady(payment.id);
    return jsonSuccess({ sent: true });
  } catch (error) {
    console.error("[api/payments/resend-link]", describeError(error));
    return jsonError(500, "Couldn't send the payment link. Please try again.");
  }
}
