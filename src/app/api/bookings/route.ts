import type { NextRequest } from "next/server";
import { createBookingSchema } from "@/lib/validation/booking-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { placeholderBookingId } from "@/lib/bookings/reference";
import { isExpiredNow } from "@/lib/quotations/sync-expiry";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const quotation = await db.quotation.findUnique({
    where: { id: parsed.data.quotationId },
    include: { lead: true },
  });
  if (!quotation) return jsonError(404, "Quotation not found.");
  if (!quotation.isSelected) {
    return jsonError(409, "Select this quotation before booking it.", {
      quotationId: ["This quotation hasn't been selected yet."],
    });
  }
  if (isExpiredNow(quotation)) {
    return jsonError(409, "This quotation has expired.", { quotationId: ["This quotation has expired."] });
  }

  const existingActiveBooking = await db.booking.findFirst({
    where: { leadId: quotation.leadId, status: { not: "CANCELLED" } },
  });
  if (existingActiveBooking) {
    return jsonError(409, "This lead already has an active booking.");
  }

  // bookingId gets its real TNX-XX-XXXXXX value once payment succeeds (see
  // /api/payments/[id]/mark-success) — this placeholder just satisfies the
  // column's NOT NULL/unique constraint until then.
  const booking = await db.$transaction(async (tx) => {
    const created = await tx.booking.create({
      data: {
        bookingId: placeholderBookingId(),
        leadId: quotation.leadId,
        customerId: quotation.lead.customerId,
        status: "PENDING",
      },
    });

    await writeAudit(tx, {
      entityType: "Booking",
      entityId: created.id,
      action: "CREATE",
      note: `Booking initiated from quotation ${quotation.id}`,
    });

    return created;
  });

  return jsonSuccess(booking, 201);
}
