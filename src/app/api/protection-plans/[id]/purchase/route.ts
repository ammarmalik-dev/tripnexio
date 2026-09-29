import type { NextRequest } from "next/server";
import { purchaseProtectionPlanSchema } from "@/lib/validation/protection-plan-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission } from "@/lib/auth/permissions";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { createProtectionPlanPayment } from "@/lib/payments/create-payment";
import { getProtectionPlanOffer, leadDestinationCountryCode } from "@/lib/protection-plan/country-offer";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Staff adds Protection Plan for a passenger on the customer's behalf
 * (New_Visa.md §8: agreement is mandatory — the request must pass
 * `termsAccepted: true`). The plan is never marked PURCHASED here: it moves
 * to TERMS_ACCEPTED and becomes PURCHASED only when the payment charging it
 * succeeds (P12). On an already-paid booking that is a separate EXTRA
 * payment for the plan price; on an unpaid booking it's added to the next
 * payment link staff create. Only while the plan is still enabled for the
 * booking's destination country.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = purchaseProtectionPlanSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const plan = await db.protectionPlan.findUnique({
    where: { id },
    include: { passenger: { select: { fullName: true } }, booking: { include: { customer: true, lead: true } }, payment: { select: { status: true } } },
  });
  if (!plan) return jsonError(404, "Protection Plan not found.");
  const { booking } = plan;
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;

  // TERMS_ACCEPTED again = retry after its payment failed/expired or its link couldn't be created.
  const retry = plan.status === "TERMS_ACCEPTED" && (!plan.payment || plan.payment.status === "FAILED" || plan.payment.status === "EXPIRED");
  if (plan.status !== "OFFERED" && plan.status !== "SELECTED_TERMS_PENDING" && !retry) {
    return jsonError(409, `Can't purchase a Protection Plan from status ${plan.status}.`);
  }
  if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
    return jsonError(409, `Protection Plan can't be added to a ${booking.status.toLowerCase()} booking.`);
  }
  const offer = await getProtectionPlanOffer(leadDestinationCountryCode(booking.lead.serviceType, booking.lead.details));
  if (!offer) return jsonError(409, "Protection Plan is currently disabled for this destination country.");

  const pendingPayment = await db.payment.findFirst({ where: { bookingId: booking.id, status: "PENDING" }, select: { id: true } });
  if (pendingPayment) {
    return jsonError(409, "A payment is already pending on this booking — let it complete or expire first.");
  }
  const bookingPaid = booking.status !== "PENDING";
  if (bookingPaid && !hasPermission(session, "payments.edit")) {
    return jsonError(403, "Adding Protection Plan to a paid booking raises an extra payment, which needs payment permission.");
  }

  const now = new Date();
  if (!retry) await db.$transaction(async (tx) => {
    await tx.protectionPlan.update({ where: { id }, data: { status: "TERMS_ACCEPTED", termsAcceptedAt: now } });
    await writeAudit(tx, {
      entityType: "ProtectionPlan",
      entityId: id,
      action: "TERMS_ACCEPTED",
      byUserId: session.id,
      note: `${plan.status} -> TERMS_ACCEPTED for ${plan.passenger.fullName}, ₹${plan.price} — customer accepted the terms (recorded by ${session.name}). Terms shown: ${offer.termsText}`,
    });
  });

  let paymentLink: string | null = null;
  if (bookingPaid) {
    try {
      const payment = await createProtectionPlanPayment({
        booking,
        plans: [{ id, price: Number(plan.price) }],
        actor: { byUserId: session.id, label: `by ${session.name}` },
      });
      paymentLink = payment.paymentLink;
    } catch (error) {
      console.error("[protection-plans/purchase] payment link failed", error);
      return jsonError(502, "Terms recorded, but the payment link couldn't be created. Try again from the Protection Plan control.");
    }
  }

  const updated = await db.protectionPlan.findUniqueOrThrow({ where: { id } });
  return jsonSuccess({ ...updated, paymentLink });
}
