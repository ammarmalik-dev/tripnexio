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

  const realBookingId = formatBookingId(payment.booking.lead.serviceType, payment.booking.id);
  const updatedBooking = await tx.booking.update({
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
