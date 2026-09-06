import type { NextRequest } from "next/server";
import { createRefundSchema } from "@/lib/validation/refund-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { computeRefundAmount, isOtbBooking } from "@/lib/refunds/pricing";

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
    include: { booking: { include: { lead: true } } },
  });
  if (!payment) return jsonError(404, "Payment not found.");
  if (payment.status !== "SUCCESS") {
    return jsonError(409, "Only a successful payment can be refunded.");
  }

  const { paidAmount, cancellationCharge, gatewayCharge, reason, otbValidated } = parsed.data;
  const serviceType = payment.booking.lead.serviceType;
  const refundAmount = computeRefundAmount(serviceType, { paidAmount, cancellationCharge, gatewayCharge, otbValidated });

  const otbNote =
    isOtbBooking(serviceType) && otbValidated ? " (includes the SAMPLE OTB fixed service charge deduction)" : "";

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
      },
    });

    await writeAudit(tx, {
      entityType: "Refund",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Refund calculated for payment ${paymentId}: ₹${refundAmount}${otbNote} (by ${session.name})${reason ? ` — reason: ${reason}` : ""}`,
    });

    return created;
  });

  return jsonSuccess(refund, 201);
}
