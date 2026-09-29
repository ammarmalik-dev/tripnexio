import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { dispatchStatusNotifications } from "@/lib/service-status/engine";
import { describeError } from "@/lib/api/describe-error";
import { afterOtbApproved, otbActionSchema, runOtbAction } from "@/lib/otb/staff-actions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * P18 — OTB staff actions (OTB.md §10-15): Staff Verification, Submitted to
 * Airline, Airline Processing, Additional Documents Required (from the
 * airline), OTB Approved (mandatory OTB PNR/reference), OTB Rejected
 * (reason; no refund) and Unable to Process (reason; raises a refund).
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
  const parsed = otbActionSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);

  const booking = await db.booking.findUnique({ where: { id }, select: { lead: { select: { serviceType: true } } } });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (booking.lead.serviceType !== "OTB") return jsonError(409, "These actions are for OTB bookings.");

  try {
    const actorLabel = `by ${session.name}`;
    const result = await runOtbAction(id, parsed.data, { userId: session.id, label: actorLabel });
    if (!result.ok) return jsonError(result.httpStatus, result.error);
    await dispatchStatusNotifications([result.notification]);
    if (result.approved) await afterOtbApproved(id, actorLabel);
    return jsonSuccess({ message: result.message });
  } catch (error) {
    console.error("[bookings/otb-action]", describeError(error));
    return jsonError(500, "Couldn't complete that action. Please try again.");
  }
}
