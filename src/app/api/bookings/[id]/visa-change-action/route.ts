import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";
import { dispatchStatusNotifications, setServiceStatusByEvent } from "@/lib/service-status/engine";
import { EXIT_METHOD_LABELS, VISA_CHANGE_ACTIONS, VISA_CHANGE_ACTION_KEYS } from "@/lib/visa-change/staff-actions";
import type { Prisma } from "@/generated/prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const actionSchema = z.object({
  action: z.enum(VISA_CHANGE_ACTION_KEYS),
  /** REJECTED: the reason the customer will see. */
  reason: z.string().trim().max(500).optional(),
  /** EXIT_COMPLETED only. */
  exit: z
    .object({
      exitAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter the exit date and time"),
      method: z.enum(["AIRPORT_TO_AIRPORT", "BORDER_EXIT"]),
      location: z.string().trim().min(2, "Enter the airport or border").max(200),
      notes: z.string().trim().max(1000).optional(),
    })
    .optional(),
});

/**
 * P14 — Visa_Change.md §22-25: staff mark Exit Completed (the customer
 * uploads nothing; CRM records exit date/time, method, airport/border, staff
 * and notes), then New Visa Processing, Additional Documents Required, and
 * Visa Approved (followed by the visa PDF delivery) or Visa Rejected (with
 * a reason the customer sees). Every step goes through the service status
 * engine, so the configured transitions decide what's allowed next.
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
  const { action, reason, exit } = parsed.data;
  if (action === "REJECTED" && (!reason || reason.length < 5)) {
    return jsonError(400, "Enter the rejection reason (the customer will see it).", { reason: ["At least 5 characters."] });
  }
  if (action === "EXIT_COMPLETED" && !exit) {
    return jsonError(400, "Enter the exit date/time, method and airport or border.", { exit: ["Required."] });
  }
  if (exit && new Date(exit.exitAt).getTime() > Date.now() + 5 * 60 * 1000) {
    return jsonError(400, "The exit date/time can't be in the future.", { exitAt: ["Can't be in the future."] });
  }

  const booking = await db.booking.findUnique({ where: { id }, select: { lead: { select: { serviceType: true } } } });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (booking.lead.serviceType !== "VISA_CHANGE") return jsonError(409, "These actions are only for Visa Change bookings.");

  const { event, label } = VISA_CHANGE_ACTIONS[action];
  const note =
    action === "REJECTED"
      ? `${label}: ${reason}`
      : action === "EXIT_COMPLETED" && exit
        ? `${label}: ${EXIT_METHOD_LABELS[exit.method]} via ${exit.location}${exit.notes ? ` — ${exit.notes}` : ""}`
        : label;

  try {
    const result = await db.$transaction(async (tx) => {
      const outcome = await setServiceStatusByEvent(tx, { scope: "BOOKING", entityId: id, event, note, userId: session.id, actorLabel: `by ${session.name}` });
      if (!outcome.ok) return outcome;
      if (action === "EXIT_COMPLETED" && exit) {
        const exitAt = new Date(exit.exitAt);
        await tx.booking.update({
          where: { id },
          data: {
            exitCompletedAt: exitAt,
            exitDetails: {
              method: exit.method,
              location: exit.location,
              notes: exit.notes ?? null,
              staffId: session.id,
              staffName: session.name,
              recordedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
        await writeAudit(tx, {
          entityType: "Booking",
          entityId: id,
          action: "VISA_CHANGE_EXIT_COMPLETED",
          byUserId: session.id,
          note: `Exit completed ${exitAt.toISOString()} — ${EXIT_METHOD_LABELS[exit.method]} via ${exit.location}${exit.notes ? `; notes: ${exit.notes}` : ""} (by ${session.name})`,
        });
      }
      if (action === "REJECTED") {
        await tx.booking.update({ where: { id }, data: { visaRejectionReason: reason } });
        await writeAudit(tx, { entityType: "Booking", entityId: id, action: "VISA_REJECTED", byUserId: session.id, note: `Rejection reason: ${reason} (by ${session.name})` });
      }
      return outcome;
    });
    if (!result.ok) return jsonError(result.httpStatus, result.error);
    await dispatchStatusNotifications([result.notification]);

    const updated = await db.booking.findUnique({
      where: { id },
      select: { id: true, status: true, exitCompletedAt: true, exitDetails: true, visaRejectionReason: true, serviceStatus: { select: { id: true, name: true } } },
    });
    return jsonSuccess(updated);
  } catch (error) {
    console.error("[bookings/visa-change-action]", error);
    return jsonError(500, "Couldn't record this action. Please try again.");
  }
}
