import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { dispatchStatusNotifications, setServiceStatusByEvent } from "@/lib/service-status/engine";
import { EMBASSY_ACTIONS, EMBASSY_ACTION_KEYS } from "@/lib/new-visa/embassy-actions";
import { openRefundReviewsForRejectedVisa } from "@/lib/protection-plan/lifecycle";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const actionSchema = z.object({
  action: z.enum(EMBASSY_ACTION_KEYS),
  /** Mandatory for REJECTED — shown to the customer. */
  reason: z.string().trim().max(500).optional(),
});

/**
 * P11 — New Visa embassy actions on a booking, through the per-service status
 * engine (transitions validated, audited, customer notified if configured).
 * Applied to Embassy stores its date; Rejected needs a reason the customer
 * will see. Visa Approved is followed by delivering the visa PDF (Deliver to
 * customer), which moves it to Visa Delivered, and only then Completed.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { action, reason } = parsed.data;
  if (action === "REJECTED" && (!reason || reason.length < 5)) {
    return jsonError(400, "Enter the rejection reason (the customer will see it).", { reason: ["At least 5 characters."] });
  }

  const booking = await db.booking.findUnique({ where: { id }, select: { lead: { select: { serviceType: true } } } });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (booking.lead.serviceType !== "NEW_VISA") return jsonError(409, "Embassy actions are only for New Visa bookings.");

  const { event, label } = EMBASSY_ACTIONS[action];
  const result = await db.$transaction(async (tx) => {
    const outcome = await setServiceStatusByEvent(tx, {
      scope: "BOOKING",
      entityId: id,
      event,
      note: reason ? `${label}: ${reason}` : label,
      userId: session.id,
      actorLabel: `by ${session.name}`,
    });
    if (!outcome.ok) return outcome;
    if (action === "APPLIED") {
      await tx.booking.update({ where: { id }, data: { appliedToEmbassyAt: new Date() } });
    }
    if (action === "REJECTED") {
      await tx.booking.update({ where: { id }, data: { visaRejectionReason: reason } });
      await writeAudit(tx, { entityType: "Booking", entityId: id, action: "VISA_REJECTED", byUserId: session.id, note: `Rejection reason: ${reason} (by ${session.name})` });
      // P12 — purchased Protection Plans go to refund review (manager task).
      await openRefundReviewsForRejectedVisa(tx, id, reason ?? "", { byUserId: session.id, label: `by ${session.name}` });
    }
    return outcome;
  });
  if (!result.ok) return jsonError(result.httpStatus, result.error);
  await dispatchStatusNotifications([result.notification]);

  const updated = await db.booking.findUnique({
    where: { id },
    select: { id: true, status: true, appliedToEmbassyAt: true, visaRejectionReason: true, serviceStatus: { select: { id: true, name: true } } },
  });
  return jsonSuccess(updated);
}
