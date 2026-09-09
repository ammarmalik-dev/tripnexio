import type { NextRequest } from "next/server";
import { setExtensionOutcomeSchema } from "@/lib/validation/extension-outcome-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { assertValidBookingTransition } from "@/lib/bookings/transitions";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Visa_Extension.md §17-18 (Step 15): "Not Accepted" and "Rejected" are
 * distinct terminal CRM statuses with different refund treatment (see
 * src/lib/refunds/rules.ts). Also moves Booking.status to CANCELLED —
 * neither outcome is a successful completion, and CANCELLED is the
 * existing generic terminal-unsuccessful state (same reasoning as every
 * other service reusing BookingStatus rather than a bespoke enum, per
 * Step 14's BookingPassenger doc comment).
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
  if (booking.lead.serviceType !== "VISA_EXTENSION") {
    return jsonError(409, "This outcome only applies to Visa Extension bookings.");
  }

  const transitionError = assertValidBookingTransition(booking.status, "CANCELLED");
  if (transitionError) return jsonError(409, transitionError);

  const outcomeLabel = parsed.data.outcome === "NOT_ACCEPTED" ? "Not Accepted" : "Rejected";

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.booking.update({
      where: { id },
      data: { extensionOutcome: parsed.data.outcome, status: "CANCELLED" },
    });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: id,
      action: "EXTENSION_OUTCOME_SET",
      byUserId: session.id,
      note: `Extension outcome recorded: ${outcomeLabel} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
