import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { writeAudit } from "@/lib/audit/log";
import { dispatchStatusNotifications, setServiceStatusByEvent } from "@/lib/service-status/engine";
import { EMBASSY_ACTIONS, EMBASSY_ACTION_KEYS } from "@/lib/new-visa/embassy-actions";
import { openRefundReviewsForRejectedVisa } from "@/lib/protection-plan/lifecycle";
import { setBookingVendor, vendorChoiceBlock } from "@/lib/bookings/set-vendor";
import { bookingDocumentsWhere } from "@/lib/documents/document-lead";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const actionSchema = z.object({
  action: z.enum(EMBASSY_ACTION_KEYS),
  /** Mandatory for REJECTED — shown to the customer. */
  reason: z.string().trim().max(500).optional(),
  /** Client testing 2026-10-09 (E12) — mandatory for APPLIED: the vendor processing this visa. */
  vendorId: z.string().trim().min(1).optional(),
});

/**
 * P11 — New Visa embassy actions on a booking, through the per-service status
 * engine (transitions validated, audited, customer notified if configured).
 * Applied to Embassy stores its date; Rejected needs a reason the customer
 * will see. Approval is recorded by delivering the visa PDF (Deliver to customer, client doc 2026-10-20).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.edit");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  // Client doc 2026-10-15 (C6) — only the record's own staff (or a manager / Admin) can act on it.
  const ownershipError = await assertOwnsEntity(auth.session, "booking", id);
  if (ownershipError) return ownershipError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const { action, reason, vendorId } = parsed.data;
  if (action === "REJECTED" && (!reason || reason.length < 5)) {
    return jsonError(400, "Enter the rejection reason (the customer will see it).", { reason: ["At least 5 characters."] });
  }

  const booking = await db.booking.findUnique({ where: { id }, select: { leadId: true, lead: { select: { serviceType: true } } } });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  const actionError = assertServiceAction(session, booking.lead.serviceType, "BOOKING");
  if (actionError) return actionError;
  if (booking.lead.serviceType !== "NEW_VISA") return jsonError(409, "Embassy actions are only for New Visa bookings.");

  // Looked up before the transaction (no global db inside one).
  const vendor = action === "APPLIED" && vendorId ? await db.vendor.findFirst({ where: { id: vendorId, active: true }, select: { id: true, name: true } }) : null;
  if (action === "APPLIED" && !vendor) {
    return jsonError(400, "Select the vendor processing this visa before marking it Applied.", { vendorId: ["Select a vendor."] });
  }
  // Client doc 2026-10-15 (I7) — the vendor is picked once every document is validated.
  if (action === "APPLIED") {
    const documents = await db.document.findMany({ where: bookingDocumentsWhere({ id, leadId: booking.leadId }), select: { type: true, status: true, purgedAt: true } });
    const blocked = vendorChoiceBlock("NEW_VISA", documents);
    if (blocked) return jsonError(409, blocked);
  }

  const { event, label } = EMBASSY_ACTIONS[action];
  const result = await db.$transaction(async (tx) => {
    const outcome = await setServiceStatusByEvent(tx, {
      scope: "BOOKING",
      entityId: id,
      event,
      note: reason ? `${label}: ${reason}` : label,
      userId: session.id,
      actorLabel: `by ${session.name}`,
      inputs: reason ? { reason } : undefined,
    });
    if (!outcome.ok) return outcome;
    if (action === "APPLIED") {
      await tx.booking.update({ where: { id }, data: { appliedToEmbassyAt: new Date() } });
      if (vendor) await setBookingVendor(tx, { bookingId: id, leadId: booking.leadId, vendor, actor: { userId: session.id, name: session.name } });
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
