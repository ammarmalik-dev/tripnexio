import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertServiceAccess } from "@/lib/auth/service-scope";
import type { Prisma } from "@/generated/prisma/client";

const verifyExpirySchema = z.object({
  verifiedExpiryDate: z
    .string()
    .min(1, "Enter the verified expiry date")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Enter a valid date"),
});

export type VisaExtensionEligibilityOutcome = "ELIGIBLE" | "URGENT_TODAY" | "NOT_ELIGIBLE";

/**
 * Visa_Extension.md §8/§9: staff manually verifies the actual visa expiry
 * date (the customer never enters or sees an unverified one, §5/§10). This
 * is the one place the ≥30-day and same-day-6PM rules actually apply --
 * they're staff-verification outcomes, not something the customer intake
 * form could enforce (the customer doesn't know their own verified
 * expiry).
 *
 * - Expired 30+ days -> NOT_ELIGIBLE (§9: "not eligible... even if the
 *   customer is willing to pay any applicable overstay fine" -- no
 *   override exists for this).
 * - Expires today (0 days) -> URGENT_TODAY, with the §9 6PM-same-working-
 *   day operational deadline surfaced as a message (not a precise UTC
 *   timestamp -- this app has no UAE-timezone infrastructure yet, and a
 *   wrong-timezone deadline would be worse than a clear text warning).
 * - Otherwise (not yet expired, or expired <30 days) -> ELIGIBLE, subject
 *   to the rest of staff's normal review (§8).
 */
function computeEligibilityOutcome(verifiedExpiryDate: string): VisaExtensionEligibilityOutcome {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(verifiedExpiryDate);
  expiry.setHours(0, 0, 0, 0);
  const daysExpired = Math.round((today.getTime() - expiry.getTime()) / 86_400_000);

  if (daysExpired >= 30) return "NOT_ELIGIBLE";
  if (daysExpired === 0) return "URGENT_TODAY";
  return "ELIGIBLE";
}

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

  const outcome = computeEligibilityOutcome(parsed.data.verifiedExpiryDate);
  const existingDetails = (lead.details as Record<string, unknown>) ?? {};

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
        } as Prisma.InputJsonValue,
      },
    });

    await writeAudit(tx, {
      entityType: "Lead",
      entityId: id,
      action: "VISA_EXTENSION_EXPIRY_VERIFIED",
      byUserId: session.id,
      note: `Verified expiry ${parsed.data.verifiedExpiryDate} -> ${outcome} (by ${session.name})`,
    });

    return result;
  });

  return jsonSuccess({ leadId: updated.id, verifiedExpiryDate: parsed.data.verifiedExpiryDate, outcome });
}
