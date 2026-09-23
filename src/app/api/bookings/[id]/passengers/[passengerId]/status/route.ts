import type { NextRequest } from "next/server";
import { updateBookingStatusSchema } from "@/lib/validation/booking-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { assertValidBookingTransition } from "@/lib/bookings/transitions";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";

interface RouteParams {
  params: Promise<{ id: string; passengerId: string }>;
}

/**
 * CRM.md §12 (Step 14): a passenger's own status, independently settable
 * from the booking-level one (PATCH /api/bookings/[id]/status, unchanged).
 * Reuses the same BookingStatus transition rules as the booking-level
 * control — see BookingPassenger's schema doc comment for why.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id: bookingId, passengerId } = await params;

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

  const bookingPassenger = await db.bookingPassenger.findUnique({
    where: { bookingId_passengerId: { bookingId, passengerId } },
    include: { passenger: true, booking: { include: { lead: true } } },
  });
  if (!bookingPassenger) return jsonError(404, "This passenger isn't linked to this booking.");
  const scopeError = assertServiceAccess(session, bookingPassenger.booking.lead.serviceType);
  if (scopeError) return scopeError;

  const transitionError = assertValidBookingTransition(bookingPassenger.status, parsed.data.status);
  if (transitionError) return jsonError(409, transitionError);

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.bookingPassenger.update({
      where: { id: bookingPassenger.id },
      data: { status: parsed.data.status },
    });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: bookingId,
      action: "PASSENGER_STATUS_CHANGE",
      byUserId: session.id,
      note: `${bookingPassenger.passenger.fullName}: ${bookingPassenger.status} -> ${parsed.data.status}${parsed.data.note ? `: ${parsed.data.note}` : ""} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
