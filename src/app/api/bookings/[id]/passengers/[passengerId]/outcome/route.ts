import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
import { PASSENGER_OUTCOME_LABELS, bookingOutcomeLabel } from "@/lib/bookings/passenger-outcomes";
import { describeError } from "@/lib/api/describe-error";
import { applySystemEvent, dispatchStatusNotifications, type StatusNotification } from "@/lib/service-status/engine";

interface RouteParams {
  params: Promise<{ id: string; passengerId: string }>;
}

const schema = z.object({
  outcome: z.enum(["APPROVED", "REJECTED", "CANCELLED"]).nullable(),
  reason: z.string().trim().min(5, "Give a short reason (at least 5 characters)").max(300),
});

/**
 * Client doc 2026-10-15 (I4) — record one passenger's own result on a booking (approved, rejected or
 * cancelled), with a reason; audited, and the booking reads Partially Approved / Partially Cancelled.
 * Once a passenger is approved only an Admin may change it (I1/I9). Refunds are raised as usual from the
 * Payments section, with this passenger selected.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id: bookingId, passengerId } = await params;
  const ownershipError = await assertOwnsEntity(session, "booking", bookingId);
  if (ownershipError) return ownershipError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  try {
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { bookingId: true, lead: { select: { serviceType: true } }, passengers: { select: { passengerId: true, outcome: true, passenger: { select: { fullName: true } } } } },
    });
    if (!booking) return jsonError(404, "Booking not found.");
    const scopeError = assertServiceAccess(session, booking.lead.serviceType);
    if (scopeError) return scopeError;
    const row = booking.passengers.find((passenger) => passenger.passengerId === passengerId);
    if (!row) return jsonError(404, "That passenger isn't on this booking.");
    if (row.outcome === "APPROVED" && parsed.data.outcome !== "APPROVED" && !session.permissions.includes(ADMIN_FULL_PERMISSION)) {
      return jsonError(409, "This passenger is approved — only an Admin can change that.");
    }

    const label = (value: string | null) => (value ? PASSENGER_OUTCOME_LABELS[value as keyof typeof PASSENGER_OUTCOME_LABELS] : "In progress");
    const after = booking.passengers.map((passenger) => (passenger.passengerId === passengerId ? { outcome: parsed.data.outcome } : { outcome: passenger.outcome }));
    let statusNotification: StatusNotification | null = null;
    await db.$transaction(async (tx) => {
      await tx.bookingPassenger.update({
        where: { bookingId_passengerId: { bookingId, passengerId } },
        data: { outcome: parsed.data.outcome, outcomeNote: parsed.data.reason, outcomeAt: new Date() },
      });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: bookingId,
        action: "PASSENGER_OUTCOME",
        byUserId: session.id,
        note: `${row.passenger.fullName}: ${label(row.outcome)} -> ${label(parsed.data.outcome)} — reason: ${parsed.data.reason} (by ${session.name})`,
      });
      // Client doc 2026-10-20 — some passengers approved, others not: "Approved for partial applicants" (its message
      // names who was approved and the others' outcomes). Once every passenger has a result and at least one was
      // approved, the booking reads Completed (N2).
      const approved = after.filter((entry) => entry.outcome === "APPROVED").length;
      if (approved > 0 && approved < after.length) {
        statusNotification = await applySystemEvent(tx, { scope: "BOOKING", entityId: bookingId, event: "PARTIAL_APPROVED", userId: session.id, actorLabel: `by ${session.name}` });
      }
      if (approved > 0 && after.every((entry) => entry.outcome !== null)) {
        const current = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { status: true } });
        if (current.status !== "COMPLETED" && current.status !== "REFUNDED") {
          await tx.booking.update({ where: { id: bookingId }, data: { status: "COMPLETED" } });
          await writeAudit(tx, { entityType: "Booking", entityId: bookingId, action: "STATUS_CHANGE", byUserId: session.id, note: `${current.status} -> COMPLETED — every passenger has a result (by ${session.name})` });
        }
      }
    });
    await dispatchStatusNotifications([statusNotification]);
    return jsonSuccess({ passengerId, outcome: parsed.data.outcome, bookingOutcome: bookingOutcomeLabel(after) });
  } catch (error) {
    console.error("[api/bookings/passengers/outcome]", describeError(error));
    return jsonError(500, "Couldn't save the passenger's result.");
  }
}
