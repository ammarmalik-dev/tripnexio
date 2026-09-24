import type { Prisma, Payment, Booking, Lead } from "../../generated/prisma/client";
import type { PaymentStatus } from "../../generated/prisma/enums";
import { writeAudit } from "../audit/log";
import { formatBookingId } from "../bookings/reference";

type PaymentWithBookingLead = Payment & { booking: Booking & { lead: Lead } };

interface ActorInfo {
  /** Staff user id when a human triggered this (manual mark-success); omitted for a gateway webhook. */
  byUserId?: string;
  /** e.g. "by Sample Admin" or "via Razorpay webhook" — appended to every audit note this call writes. */
  actorLabel: string;
}

/**
 * Shared by the manual staff "mark success" route and the gateway webhook
 * handler — both need the exact same transition: Payment -> SUCCESS,
 * Booking gets its real TNX-XX-XXXXXX id and moves to CONFIRMED, Lead moves
 * to CONVERTED. Idempotent: a payment that's already SUCCESS is returned
 * as-is with no further writes, since gateway webhooks can be redelivered.
 */
export async function completePaymentSuccess(
  tx: Prisma.TransactionClient,
  payment: PaymentWithBookingLead,
  actor: ActorInfo,
  options: { gatewayRef?: string } = {}
): Promise<{ payment: Payment; booking: Booking; lead: Lead; didTransition: boolean }> {
  if (payment.status === "SUCCESS") {
    return { payment, booking: payment.booking, lead: payment.booking.lead, didTransition: false };
  }

  const updatedPayment = await tx.payment.update({
    where: { id: payment.id },
    data: { status: "SUCCESS", gatewayRef: options.gatewayRef ?? payment.gatewayRef ?? undefined },
  });
  await writeAudit(tx, {
    entityType: "Payment",
    entityId: payment.id,
    action: "STATUS_CHANGE",
    byUserId: actor.byUserId,
    note: `${payment.status} -> SUCCESS (${actor.actorLabel})`,
  });

  // Step 22 (audit §3.2/§4.2/§7.8) — "increment Coupon.usageCount on
  // successful payment (not on quote creation, since a quote can expire
  // unused)." This is the one place across both trigger points (manual
  // mark-success and the gateway webhook) that a payment ever genuinely
  // transitions to SUCCESS — gated by the same didTransition semantics
  // this function already guarantees (an already-SUCCESS payment returns
  // early above, before this point), so a redelivered webhook can never
  // double-increment.
  if (payment.couponId) {
    await tx.coupon.update({ where: { id: payment.couponId }, data: { usageCount: { increment: 1 } } });
    await writeAudit(tx, {
      entityType: "Coupon",
      entityId: payment.couponId,
      action: "USAGE_INCREMENT",
      byUserId: actor.byUserId,
      note: `Used on payment ${payment.id} (${actor.actorLabel})`,
    });
  }

  // Step 52 — an EXTRA payment (Extra Payment Collection) can succeed
  // against a Booking that's already CONFIRMED (its primary payment
  // already went through earlier). Re-deriving/re-writing the same
  // bookingId and re-"transitioning" an already-CONFIRMED booking to
  // CONFIRMED would be a harmless no-op data-wise but a misleading audit
  // note every time — skip this block entirely once the booking is
  // already CONFIRMED, matching the idempotency the Payment/Lead sections
  // above and below already have.
  let updatedBooking: Booking = payment.booking;
  if (payment.booking.status !== "CONFIRMED") {
    // Derived from the Lead's own id (not the Booking row's id) — see the doc
    // comment on formatBookingId: this is the "Lead ID becomes Booking ID"
    // rule, not a fresh, unrelated identifier.
    const realBookingId = formatBookingId(payment.booking.lead.serviceType, payment.booking.leadId);
    updatedBooking = await tx.booking.update({
      where: { id: payment.bookingId },
      data: { bookingId: realBookingId, status: "CONFIRMED" },
    });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: payment.bookingId,
      action: "STATUS_CHANGE",
      byUserId: actor.byUserId,
      note: `${payment.booking.status} -> CONFIRMED, bookingId assigned (${realBookingId}) (${actor.actorLabel})`,
    });
  }

  let updatedLead = payment.booking.lead;
  if (updatedLead.status !== "CONVERTED") {
    const previousStatus = updatedLead.status;
    updatedLead = await tx.lead.update({ where: { id: updatedLead.id }, data: { status: "CONVERTED" } });
    await writeAudit(tx, {
      entityType: "Lead",
      entityId: updatedLead.id,
      action: "STATUS_CHANGE",
      byUserId: actor.byUserId,
      note: `${previousStatus} -> CONVERTED (payment succeeded, ${actor.actorLabel})`,
    });
  }

  return { payment: updatedPayment, booking: updatedBooking, lead: updatedLead, didTransition: true };
}

/**
 * A failed/expired gateway payment — the Booking/Lead are left untouched
 * (booking stays PENDING) so staff can simply create a new payment and
 * retry; only the Payment itself records the failure.
 */
export async function failPayment(
  tx: Prisma.TransactionClient,
  payment: Payment,
  status: Extract<PaymentStatus, "FAILED" | "EXPIRED">,
  actor: ActorInfo
): Promise<Payment> {
  if (payment.status !== "PENDING") {
    return payment;
  }

  const updated = await tx.payment.update({ where: { id: payment.id }, data: { status } });
  await writeAudit(tx, {
    entityType: "Payment",
    entityId: payment.id,
    action: "STATUS_CHANGE",
    byUserId: actor.byUserId,
    note: `PENDING -> ${status} (${actor.actorLabel})`,
  });
  return updated;
}
