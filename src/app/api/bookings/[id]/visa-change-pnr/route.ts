import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import { writeAudit } from "@/lib/audit/log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const pnrSchema = z.object({
  pnr: z
    .string()
    .trim()
    .min(5, "Enter the PNR (5–8 characters)")
    .max(8, "Enter the PNR (5–8 characters)")
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only"),
});

/**
 * Client corrections 2026-10-05 §8 — an Airport-to-Airport Visa Change
 * records the flight PNR once the booking is confirmed (paid). Stored on the
 * booking (same column Special Fare uses), audited, and printed on the
 * package PDF generated after it.
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
  const parsed = pnrSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const pnr = parsed.data.pnr.toUpperCase();

  const booking = await db.booking.findUnique({ where: { id }, select: { id: true, status: true, pnr: true, lead: { select: { serviceType: true, details: true } } } });
  if (!booking) return jsonError(404, "Booking not found.");
  const scopeError = assertServiceAccess(session, booking.lead.serviceType);
  if (scopeError) return scopeError;
  if (booking.lead.serviceType !== "VISA_CHANGE" || (booking.lead.details as Record<string, unknown> | null)?.changeType !== "AIRPORT_TO_AIRPORT") {
    return jsonError(409, "A PNR is recorded only on an Airport-to-Airport Visa Change booking.");
  }
  if (booking.status === "PENDING" || booking.status === "CANCELLED" || booking.status === "REFUNDED") {
    return jsonError(409, "Record the PNR after the booking is confirmed (payment received).");
  }

  await db.$transaction(async (tx) => {
    await tx.booking.update({ where: { id }, data: { pnr, pnrRecordedAt: new Date() } });
    await writeAudit(tx, {
      entityType: "Booking",
      entityId: id,
      action: "PNR_RECORDED",
      byUserId: session.id,
      note: booking.pnr ? `A2A PNR changed ${booking.pnr} → ${pnr} (by ${session.name})` : `A2A PNR recorded: ${pnr} (by ${session.name})`,
    });
  });
  return jsonSuccess({ pnr });
}
