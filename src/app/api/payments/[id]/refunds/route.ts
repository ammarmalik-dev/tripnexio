import type { NextRequest } from "next/server";
import { createRefundSchema } from "@/lib/validation/refund-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { computeRefundAmount } from "@/lib/refunds/pricing";
import { evaluateRefundRule, documentsValidated } from "@/lib/refunds/rules";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** The refund calculator: staff enters paidAmount/cancellationCharge/gatewayCharge, refundAmount is always computed server-side. */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("refunds.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id: paymentId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createRefundSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      booking: {
        include: { lead: true, passengers: { include: { passenger: true } }, documents: true },
      },
    },
  });
  if (!payment) return jsonError(404, "Payment not found.");
  if (payment.status !== "SUCCESS") {
    return jsonError(409, "Only a successful payment can be refunded.");
  }

  const { paidAmount, cancellationCharge, gatewayCharge, reason, passengerIds } = parsed.data;

  // CRM.md §21 (Step 14): "Passenger selection where partial passenger
  // refund applies" — validated against this booking's own passengers, not
  // trusted blindly from the client.
  const bookingPassengerIds = new Set(payment.booking.passengers.map((bp) => bp.passengerId));
  const invalidPassengerIds = (passengerIds ?? []).filter((pid) => !bookingPassengerIds.has(pid));
  if (invalidPassengerIds.length > 0) {
    return jsonError(400, "One or more selected passengers don't belong to this booking.", {
      passengerIds: ["Invalid passenger selection."],
    });
  }

  // Step 15 (audit §7.4): the per-service refund rule engine — decides
  // whether a refund is allowed at all right now, and the mandatory
  // fixedDeduction on top of whatever staff enter. `payment.updatedAt` is
  // used as "payment succeeded at" — Payment has no separate success-
  // timestamp column, and this row is otherwise only ever updated by the
  // PENDING->SUCCESS transition (completePaymentSuccess), so it's a
  // reasonable proxy.
  const rule = evaluateRefundRule({
    serviceType: payment.booking.lead.serviceType,
    bookingStatus: payment.booking.status,
    documentsValidated: documentsValidated(payment.booking.documents),
    extensionOutcome: payment.booking.extensionOutcome,
    paymentSucceededAt: payment.updatedAt,
  });
  if (!rule.allowed) {
    return jsonError(409, rule.label);
  }

  const refundAmount = computeRefundAmount({ paidAmount, cancellationCharge, gatewayCharge, fixedDeduction: rule.fixedDeduction });

  const ruleNote = rule.fixedDeduction > 0 ? ` (includes ₹${rule.fixedDeduction} per: ${rule.label})` : "";

  const passengerNames = (passengerIds ?? [])
    .map((pid) => payment.booking.passengers.find((bp) => bp.passengerId === pid)?.passenger.fullName)
    .filter((name): name is string => Boolean(name));
  const passengerNote = passengerNames.length > 0 ? ` — passengers: ${passengerNames.join(", ")}` : "";

  const refund = await db.$transaction(async (tx) => {
    const created = await tx.refund.create({
      data: {
        paymentId,
        paidAmount,
        cancellationCharge,
        gatewayCharge,
        refundAmount,
        reason,
        status: "PENDING",
        passengerIds: passengerIds ?? [],
      },
    });

    await writeAudit(tx, {
      entityType: "Refund",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Refund calculated for payment ${paymentId}: ₹${refundAmount}${ruleNote}${passengerNote} (by ${session.name})${reason ? ` — reason: ${reason}` : ""}`,
    });

    return created;
  });

  return jsonSuccess({ ...refund, appliedRule: rule }, 201);
}
