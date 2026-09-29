import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import type { Prisma } from "@/generated/prisma/client";
import { computeEligibilityOutcome } from "@/lib/visa-extension/rules";
import { computeUrgentDeadline, extensionToday } from "@/lib/visa-extension/urgency";

const verifyExpirySchema = z.object({
  verifiedExpiryDate: z
    .string()
    .min(1, "Enter the verified expiry date")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date"),
});

/**
 * Visa_Extension.md §8/§9: staff manually verifies the actual visa expiry
 * date (the customer never enters or sees an unverified one, §5/§10). The
 * outcome (see computeEligibilityOutcome) gates quoting (P13). An
 * URGENT_TODAY case also stores its 6:00 PM same-working-day payment
 * deadline, computed on the UAE working calendar, plus any UAE/India
 * holiday on the following day as an extra urgent warning.
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("leads.edit");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = verifyExpirySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const lead = await db.lead.findUnique({ where: { id } });
  if (!lead) return jsonError(404, "Lead not found.");
  const scopeError = assertServiceAccess(session, lead.serviceType);
  if (scopeError) return scopeError;
  if (lead.serviceType !== "VISA_EXTENSION") {
    return jsonError(409, "This action only applies to Visa Extension leads.");
  }

  const outcome = computeEligibilityOutcome(parsed.data.verifiedExpiryDate, await extensionToday());
  const urgentDeadline = outcome === "URGENT_TODAY" ? await computeUrgentDeadline() : null;
  const { urgentDeadline: _previousDeadline, ...existingDetails } = (lead.details as Record<string, unknown>) ?? {};
  void _previousDeadline;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.lead.update({
      where: { id },
      data: {
        details: {
          ...existingDetails,
          verifiedExpiryDate: parsed.data.verifiedExpiryDate,
          eligibilityOutcome: outcome,
          verifiedByStaffId: session.id,
          verifiedAt: new Date().toISOString(),
          ...(urgentDeadline ? { urgentDeadline } : {}),
        } as unknown as Prisma.InputJsonValue,
      },
    });

    await writeAudit(tx, {
      entityType: "Lead",
      entityId: id,
      action: "VISA_EXTENSION_EXPIRY_VERIFIED",
      byUserId: session.id,
      note: `Verified expiry ${parsed.data.verifiedExpiryDate} -> ${outcome}${urgentDeadline ? `, pay by 6:00 PM ${urgentDeadline.day}${urgentDeadline.nextDayHolidays.length > 0 ? ` (next day holiday: ${urgentDeadline.nextDayHolidays.map((h) => `${h.country} ${h.name}`).join(", ")})` : ""}` : ""} (by ${session.name})`,
    });

    return result;
  });

  return jsonSuccess({ leadId: updated.id, verifiedExpiryDate: parsed.data.verifiedExpiryDate, outcome, urgentDeadline });
}
