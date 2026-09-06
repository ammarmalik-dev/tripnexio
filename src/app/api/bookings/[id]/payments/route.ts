import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// No real payment gateway is integrated yet (see CLAUDE.md Milestones —
// that's M2/M3 work). These are clearly-labeled SAMPLE rates standing in
// for real, admin-configured tax/gateway-fee settings — not a claim about
// actual GST or gateway pricing.
const SAMPLE_GST_RATE = 0.05;
const SAMPLE_GATEWAY_FEE_RATE = 0.02;

function roundToPaise(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { id: bookingId } = await params;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { lead: { include: { quotations: { where: { isSelected: true } } } } },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  if (booking.status !== "PENDING") {
    return jsonError(409, "This booking is no longer pending — a payment can't be created for it.");
  }

  const existingPending = await db.payment.findFirst({ where: { bookingId, status: "PENDING" } });
  if (existingPending) {
    return jsonError(409, "A pending payment already exists for this booking.");
  }

  const selectedQuotation = booking.lead.quotations[0];
  if (!selectedQuotation) {
    return jsonError(409, "No selected quotation found for this booking's lead.");
  }

  const amount = Number(selectedQuotation.sellingPrice);
  const gstAmount = roundToPaise(amount * SAMPLE_GST_RATE);
  const gatewayFee = roundToPaise(amount * SAMPLE_GATEWAY_FEE_RATE);

  const payment = await db.$transaction(async (tx) => {
    const created = await tx.payment.create({
      data: {
        bookingId,
        amount,
        gstAmount,
        gatewayFee,
        status: "PENDING",
        // Stub — no real payment gateway yet, see module comment above.
        paymentLink: `https://pay.tripnexio.example/checkout/${bookingId}`,
        linkExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await writeAudit(tx, {
      entityType: "Payment",
      entityId: created.id,
      action: "CREATE",
      note: `Payment created for booking ${bookingId} — amount ${amount}`,
    });

    return created;
  });

  return jsonSuccess(payment, 201);
}
