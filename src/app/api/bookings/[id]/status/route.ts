import type { NextRequest } from "next/server";
import { serviceStatusChangeSchema } from "@/lib/validation/service-status-change-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { ADMIN_FULL_PERMISSION } from "@/lib/auth/permissions";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { assertServiceAction } from "@/lib/auth/service-actions";
import { dispatchStatusNotifications, getAllowedNextServiceStatuses, isApplyStepStatus, setServiceStatus } from "@/lib/service-status/engine";
import { assertOwnsEntity } from "@/lib/auth/ownership-entity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** The booking's current per-service status and the statuses it may move to next (CRM.md §14). */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("bookings.view");
  if (auth.error) return auth.error;
  const { id } = await params;

  const booking = await db.booking.findUnique({ where: { id }, select: { lead: { select: { serviceType: true } } } });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(auth.session, booking.lead.serviceType);
  if (scopeError) return scopeError;

  const state = await getAllowedNextServiceStatuses("BOOKING", id);
  // Client doc 2026-10-15 (I9) — an Admin may override the flow (the PATCH re-checks).
  return jsonSuccess(state ? { ...state, canOverride: auth.session.permissions.includes(ADMIN_FULL_PERMISSION) } : state);
}

/** Staff Change Status — only a transition configured for this service is accepted (P08). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  const parsed = serviceStatusChangeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const booking = await db.booking.findUnique({ where: { id }, select: { lead: { select: { serviceType: true } } } });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  const actionError = assertServiceAction(session, booking.lead.serviceType, "UPDATE_STATUS");
  if (actionError) return actionError;

  // P11/P13/P14 — a New Visa, Visa Change or Visa Extension booking completes only after its visa PDF was delivered.
  // Client doc 2026-10-20 — a Visa Extension is approved before its copy arrives ("shared once received"), so only
  // New Visa / Visa Change need the visa PDF delivered first.
  const requiredOutput = booking.lead.serviceType === "NEW_VISA" || booking.lead.serviceType === "VISA_CHANGE" ? "VISA_PDF" : null;
  if (requiredOutput) {
    const target = await db.serviceStatus.findUnique({ where: { id: parsed.data.serviceStatusId }, select: { mapsToBookingStatus: true } });
    if (target?.mapsToBookingStatus === "COMPLETED") {
      const delivered = await db.document.count({ where: { bookingId: id, type: requiredOutput, deliveredAt: { not: null } } });
      if (delivered === 0) {
        return jsonError(409, "Deliver the visa PDF to the customer (Deliver to customer) — that records the approval.");
      }
    }
  }

  // Client doc 2026-10-15 (I9) — only an Admin may override, and always with a reason.
  const adminOverride = parsed.data.override === true;
  if (adminOverride && !session.permissions.includes(ADMIN_FULL_PERMISSION)) return jsonError(403, "Only an Admin can override the status flow.");
  if (adminOverride && (parsed.data.note?.length ?? 0) < 5) return jsonError(400, "Give a reason for the override (at least 5 characters).", { note: ["Reason required"] });

  // Client doc 2026-10-27 (C1/C13) — Sent to Airlines / Applied to Embassy go through the service's own button,
  // which asks for the vendor (and checks the documents); only an Admin override may set it from here.
  if (!adminOverride) {
    const target = await db.serviceStatus.findUnique({ where: { id: parsed.data.serviceStatusId }, select: { name: true, systemEvent: true } });
    if (target && isApplyStepStatus(booking.lead.serviceType, target)) {
      return jsonError(409, `Use the "${target.name}" button on the booking's action panel — it asks for the vendor.`);
    }
  }

  const result = await db.$transaction((tx) =>
    setServiceStatus(tx, {
      scope: "BOOKING",
      entityId: id,
      toStatusId: parsed.data.serviceStatusId,
      note: parsed.data.note,
      userId: session.id,
      actorLabel: `by ${session.name}`,
      adminOverride,
      inputs: parsed.data.inputs,
    })
  );
  if (!result.ok) return jsonError(result.httpStatus, result.error);
  await dispatchStatusNotifications([result.notification]);

  const updated = await db.booking.findUnique({ where: { id }, include: { serviceStatus: { select: { id: true, name: true } } } });
  return jsonSuccess(updated);
}
