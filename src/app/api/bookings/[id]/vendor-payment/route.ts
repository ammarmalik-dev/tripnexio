import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { sensitiveReasonSchema, withReason } from "@/lib/validation/sensitive-action";
import { describeError } from "@/lib/api/describe-error";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const schema = z.object({
  /** The total paid to the vendor so far for this booking (0 = nothing paid, still on credit). */
  paidAmount: z.number({ error: "Enter the amount paid" }).min(0, "Can't be negative").max(10_000_000),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the payment date").optional(),
  reference: z.string().trim().max(80).optional(),
  reason: sensitiveReasonSchema,
});

/**
 * Client doc 16 Nov (I10) — "Credit / Paid" for the vendor / sponsor of a booking: authorised staff (finance.manage)
 * record what was paid to the vendor, the date and the transaction reference. Credit until the amount reaches the
 * selected quotation's vendor cost, then Paid. Audited with the previous and new values.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("finance.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { paidAmount, paidAt, reference, reason } = parsed.data;

  try {
    const booking = await db.booking.findUnique({
      where: { id },
      select: { id: true, bookingId: true, vendorPaidAmount: true, vendorPaymentRef: true, lead: { select: { serviceType: true } } },
    });
    if (!booking) return jsonError(404, "Booking not found.");
    const scopeError = assertServiceAccess(session, booking.lead.serviceType);
    if (scopeError) return scopeError;

    const updated = await db.$transaction(async (tx) => {
      const saved = await tx.booking.update({
        where: { id },
        data: {
          vendorPaidAmount: paidAmount,
          vendorPaidAt: paidAt ? new Date(`${paidAt}T00:00:00Z`) : paidAmount > 0 ? new Date() : null,
          vendorPaymentRef: reference || null,
        },
        select: { vendorPaidAmount: true, vendorPaidAt: true, vendorPaymentRef: true },
      });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: id,
        action: "VENDOR_PAYMENT_RECORDED",
        byUserId: session.id,
        note: withReason(
          `Vendor paid for ${booking.bookingId}: ₹${Number(booking.vendorPaidAmount ?? 0)} -> ₹${paidAmount}${reference ? ` (ref ${reference})` : ""} (by ${session.name})`,
          reason
        ),
      });
      return saved;
    });
    return jsonSuccess({ paidAmount: Number(updated.vendorPaidAmount ?? 0), paidAt: updated.vendorPaidAt, reference: updated.vendorPaymentRef });
  } catch (error) {
    console.error("[api/bookings/vendor-payment]", describeError(error));
    return jsonError(500, "Couldn't save the vendor payment.");
  }
}
