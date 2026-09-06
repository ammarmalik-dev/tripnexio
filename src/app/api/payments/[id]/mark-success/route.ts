import type { NextRequest } from "next/server";
import { markPaymentSuccessSchema } from "@/lib/validation/payment-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { formatBookingId } from "@/lib/bookings/reference";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Manual stand-in for a real payment gateway webhook (none is integrated
 * yet — see CLAUDE.md Milestones). This is where a booking's real
 * TNX-XX-XXXXXX id gets assigned, replacing its placeholder.
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
  if (payment.status !== "PENDING") {
    return jsonError(409, `This payment is already ${payment.status.toLowerCase()}.`);
  }

  const result = await db.$transaction(async (tx) => {
    const updatedPayment = await tx.payment.update({
      where: { id },
      data: {
        status: "SUCCESS",
        gatewayRef: parsed.data.gatewayRef ?? `STUB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      },
    });
    await writeAudit(tx, {
      entityType: "Payment",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `PENDING -> SUCCESS (manual stub — no real gateway yet; by ${session.name})`,
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
      byUserId: session.id,
      note: `PENDING -> CONFIRMED, bookingId assigned (${realBookingId}) (by ${session.name})`,
    });

    let updatedLead = payment.booking.lead;
    if (updatedLead.status !== "CONVERTED") {
      const previousStatus = updatedLead.status;
      updatedLead = await tx.lead.update({ where: { id: updatedLead.id }, data: { status: "CONVERTED" } });
      await writeAudit(tx, {
        entityType: "Lead",
        entityId: updatedLead.id,
        action: "STATUS_CHANGE",
        byUserId: session.id,
        note: `${previousStatus} -> CONVERTED (payment succeeded, marked by ${session.name})`,
      });
    }

    return { payment: updatedPayment, booking: updatedBooking, lead: updatedLead };
  });

  return jsonSuccess(result);
}
