import type { NextRequest } from "next/server";
import { setExtensionOutcomeSchema } from "@/lib/validation/extension-outcome-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { dispatchStatusNotifications, setServiceStatusByEvent } from "@/lib/service-status/engine";
import type { ServiceStatusSystemEvent } from "@/lib/service-status/events";
import type { ExtensionOutcome } from "@/generated/prisma/enums";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const OUTCOMES: Record<ExtensionOutcome, { event: ServiceStatusSystemEvent; label: string }> = {
  EXTENDED: { event: "EXTENSION_EXTENDED", label: "Extended" },
  NOT_ACCEPTED: { event: "EXTENSION_NOT_ACCEPTED", label: "Not Accepted" },
  REJECTED: { event: "EXTENSION_REJECTED", label: "Rejected" },
};

/**
 * Visa_Extension.md §17-19 (P13) — the immigration outcome on an extension
 * booking, applied through the per-service status engine so the configured
 * transitions decide whether it's allowed from the current status (and the
 * booking's coarse status follows: Not Accepted / Rejected land on
 * CANCELLED). Extended is followed by delivering the extended visa PDF
 * (P09 delivery -> Visa Delivered -> Completed). Recorded once.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
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

  const parsed = setExtensionOutcomeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const booking = await db.booking.findUnique({ where: { id }, include: { lead: true } });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (booking.lead.serviceType !== "VISA_EXTENSION") {
    return jsonError(409, "This outcome only applies to Visa Extension bookings.");
  }
  if (booking.extensionOutcome) {
    return jsonError(409, "An outcome was already recorded for this extension.");
  }

  const { event, label } = OUTCOMES[parsed.data.outcome];
  try {
    const result = await db.$transaction(async (tx) => {
      const outcome = await setServiceStatusByEvent(tx, {
        scope: "BOOKING",
        entityId: id,
        event,
        note: `Extension outcome: ${label}`,
        userId: session.id,
        actorLabel: `by ${session.name}`,
      });
      if (!outcome.ok) return outcome;
      await tx.booking.update({ where: { id }, data: { extensionOutcome: parsed.data.outcome } });
      await writeAudit(tx, {
        entityType: "Booking",
        entityId: id,
        action: "EXTENSION_OUTCOME_SET",
        byUserId: session.id,
        note: `Extension outcome recorded: ${label} (by ${session.name})`,
      });
      return outcome;
    });
    if (!result.ok) return jsonError(result.httpStatus, result.error);
    await dispatchStatusNotifications([result.notification]);

    const updated = await db.booking.findUnique({
      where: { id },
      select: { id: true, status: true, extensionOutcome: true, serviceStatus: { select: { id: true, name: true } } },
    });
    return jsonSuccess(updated);
  } catch (error) {
    console.error("[bookings/extension-outcome]", error);
    return jsonError(500, "Couldn't record the outcome. Please try again.");
  }
}
