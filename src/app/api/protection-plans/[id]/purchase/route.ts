import type { NextRequest } from "next/server";
import { purchaseProtectionPlanSchema } from "@/lib/validation/protection-plan-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * New_Visa.md §8: "Before purchase: full applicable conditions are
 * displayed. Customer must agree. Agreement is mandatory. Without
 * agreement the Protection Plan cannot be purchased." This is the ONE path
 * that can ever move a plan to PURCHASED — the request must explicitly
 * pass `termsAccepted: true`. Internally moves through
 * SELECTED_TERMS_PENDING -> TERMS_ACCEPTED -> PURCHASED in one atomic
 * staff action (there's no live customer checkout to click through those
 * as separate steps in this app today), but each conceptual step still
 * gets its own AuditTrail row so the narrative reads correctly.
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

  const parsed = purchaseProtectionPlanSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const plan = await db.protectionPlan.findUnique({ where: { id } });
  if (!plan) return jsonError(404, "Protection Plan not found.");

  if (plan.status !== "OFFERED" && plan.status !== "SELECTED_TERMS_PENDING") {
    return jsonError(409, `Can't purchase a Protection Plan from status ${plan.status}.`);
  }

  const now = new Date();

  const updated = await db.$transaction(async (tx) => {
    await writeAudit(tx, {
      entityType: "ProtectionPlan",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `${plan.status} -> SELECTED_TERMS_PENDING (by ${session.name})`,
    });
    await writeAudit(tx, {
      entityType: "ProtectionPlan",
      entityId: id,
      action: "TERMS_ACCEPTED",
      byUserId: session.id,
      note: `Terms accepted on behalf of the customer (by ${session.name})`,
    });

    const result = await tx.protectionPlan.update({
      where: { id },
      data: { status: "PURCHASED", termsAcceptedAt: now },
    });

    await writeAudit(tx, {
      entityType: "ProtectionPlan",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `TERMS_ACCEPTED -> PURCHASED, ₹${plan.price} (by ${session.name})`,
    });

    return result;
  });

  return jsonSuccess(updated);
}
