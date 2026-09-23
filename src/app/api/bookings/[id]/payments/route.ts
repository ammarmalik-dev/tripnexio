import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { createPendingPayment } from "@/lib/payments/create-payment";
import { isExpiredNow, syncExpiredQuotations } from "@/lib/quotations/sync-expiry";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id: bookingId } = await params;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: true,
      lead: { include: { quotations: { where: { isSelected: true } } } },
    },
  });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (booking.status !== "PENDING") {
    return jsonError(409, "This booking is no longer pending — a payment can't be created for it.");
  }

  const existingPending = await db.payment.findFirst({ where: { bookingId, status: "PENDING" } });
  if (existingPending) {
    return jsonError(409, "A pending payment already exists for this booking.");
  }

  const [selectedQuotation] = await syncExpiredQuotations(booking.lead.quotations);
  if (!selectedQuotation) {
    return jsonError(409, "No selected quotation found for this booking's lead.");
  }

  // Flight quotes have a tight (<=30 min) validity window (see
  // src/lib/quotations/pricing.ts) that can lapse between booking creation
  // and payment creation — re-check it right before generating a payment
  // link, don't just trust that it was valid when the booking was made.
  if (booking.lead.serviceType === "FLIGHT_SPECIAL_FARE" && isExpiredNow(selectedQuotation)) {
    return jsonError(409, "This flight quote has expired. Build a new quote for this lead before creating a payment.");
  }

  const payment = await createPendingPayment({
    booking,
    quotation: selectedQuotation,
    actor: { byUserId: session.id, label: `by ${session.name}` },
  });

  return jsonSuccess(payment, 201);
}
