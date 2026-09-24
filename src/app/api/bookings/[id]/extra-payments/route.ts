import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { createExtraPayment } from "@/lib/payments/create-payment";
import { createExtraPaymentSchema } from "@/lib/validation/extra-payment-schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** A booking with no real, active lifecycle yet (or none left) can't take an add-on charge. */
const INELIGIBLE_STATUSES = ["PENDING", "CANCELLED", "REFUNDED"] as const;

/**
 * Step 52 (Internal Dashboard Merged §9) — "staff create an additional
 * payment (amount, reason/description) against that booking." Reuses
 * createPendingPayment's gateway-link logic (via the shared
 * createGatewayPayment core) but decoupled from requiring a newly
 * selected quotation — the booking is already confirmed/priced; this is a
 * later, standalone add-on fee.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("payments.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id: bookingId } = await params;

  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { customer: true, lead: true } });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;

  if ((INELIGIBLE_STATUSES as readonly string[]).includes(booking.status)) {
    return jsonError(409, `An extra payment can't be raised against a ${booking.status.toLowerCase()} booking.`);
  }

  const existingPending = await db.payment.findFirst({ where: { bookingId, status: "PENDING" } });
  if (existingPending) {
    return jsonError(409, "A pending payment already exists for this booking.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createExtraPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const payment = await createExtraPayment({
    booking,
    amount: parsed.data.amount,
    description: parsed.data.description,
    actor: { byUserId: session.id, label: `by ${session.name}` },
  });

  return jsonSuccess(payment, 201);
}
