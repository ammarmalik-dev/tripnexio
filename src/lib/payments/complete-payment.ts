import type { Prisma, Payment, Booking, Lead } from "../../generated/prisma/client";
import type { PaymentStatus } from "../../generated/prisma/enums";
import { writeAudit } from "../audit/log";
import { nextInvoiceNumber } from "../invoices/invoice-number";
import { applySystemEvent, type StatusNotification } from "../service-status/engine";
import { purchasePlansForPayment } from "../protection-plan/lifecycle";

type PaymentWithBookingLead = Payment & { booking: Booking & { lead: Lead } };

interface ActorInfo {
  /** Staff user id when a human triggered this (manual mark-success); omitted for a gateway webhook. */
  byUserId?: string;
  /** e.g. "by Sample Admin" or "via Razorpay webhook" — appended to every audit note this call writes. */
  actorLabel: string;
}

/**
 * Shared by the manual staff "mark success" route and the gateway webhook
 * handler — both need the exact same transition: Payment -> SUCCESS (with
 * its persisted invoice number), Booking moves to CONFIRMED (its bookingId
 * is already the lead's reference, set at creation), Lead moves to
 * CONVERTED. Idempotent: a payment that's already SUCCESS is returned
 * as-is with no further writes, since gateway webhooks can be redelivered.
 */
export async function completePaymentSuccess(
  tx: Prisma.TransactionClient,
  payment: PaymentWithBookingLead,
  actor: ActorInfo,
  options: { gatewayRef?: string } = {}
): Promise<{ payment: Payment; booking: Booking; lead: Lead; didTransition: boolean; statusNotifications: StatusNotification[] }> {
  if (payment.status === "SUCCESS") {
    return { payment, booking: payment.booking, lead: payment.booking.lead, didTransition: false, statusNotifications: [] };
  }

  const updatedPayment = await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCESS",
      gatewayRef: options.gatewayRef ?? payment.gatewayRef ?? undefined,
      invoiceNumber: payment.invoiceNumber ?? (await nextInvoiceNumber(tx)),
    },
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

  // P12 — Protection Plans this payment charged for become PURCHASED (and any
  // OCR flag on those passengers opens an eligibility review).
  await purchasePlansForPayment(tx, payment.id, { byUserId: actor.byUserId, label: actor.actorLabel });

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
    // bookingId already carries the lead's reference ("Lead ID becomes
    // Booking ID", set at booking creation) — nothing new to assign here.
    updatedBooking = await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: "CONFIRMED" },
    });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: payment.bookingId,
      action: "STATUS_CHANGE",
      byUserId: actor.byUserId,
      note: `${payment.booking.status} -> CONFIRMED, Booking ID ${updatedBooking.bookingId} (${actor.actorLabel})`,
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

  // P08 — the per-service statuses follow (Booking "Payment Received"-style
  // status, Lead "Converted"); forward only, so an EXTRA payment on a
  // booking already further along changes nothing.
  const eventActor = { userId: actor.byUserId, actorLabel: actor.actorLabel };
  const statusNotifications = (
    await Promise.all([
      applySystemEvent(tx, { scope: "BOOKING", entityId: payment.bookingId, event: "PAYMENT_SUCCESS", ...eventActor }),
      applySystemEvent(tx, { scope: "LEAD", entityId: updatedLead.id, event: "PAYMENT_SUCCESS", ...eventActor }),
    ])
  ).filter((notification): notification is StatusNotification => notification !== null);

  return { payment: updatedPayment, booking: updatedBooking, lead: updatedLead, didTransition: true, statusNotifications };
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
