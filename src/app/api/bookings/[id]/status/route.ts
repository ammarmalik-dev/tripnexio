import type { NextRequest } from "next/server";
import { updateBookingStatusSchema } from "@/lib/validation/booking-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { assertValidBookingTransition } from "@/lib/bookings/transitions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateBookingStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return jsonError(404, "Booking not found.");

  const transitionError = assertValidBookingTransition(booking.status, parsed.data.status);
  if (transitionError) return jsonError(409, transitionError);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.booking.update({ where: { id }, data: { status: parsed.data.status } });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: id,
      action: "STATUS_CHANGE",
      note: `${booking.status} -> ${parsed.data.status}${parsed.data.note ? `: ${parsed.data.note}` : ""}`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
