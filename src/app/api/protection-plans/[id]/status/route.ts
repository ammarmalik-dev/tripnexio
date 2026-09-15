import type { NextRequest } from "next/server";
import { updateProtectionPlanStatusSchema } from "@/lib/validation/protection-plan-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertValidProtectionPlanTransition } from "@/lib/protection-plan/transitions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Generic transition endpoint for every Protection Plan status change
 * EXCEPT the move into PURCHASED, which has its own mandatory-T&C-
 * acceptance precondition and lives at PATCH .../purchase instead.
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

  const parsed = updateProtectionPlanStatusSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  if (parsed.data.status === "PURCHASED") {
    return jsonError(400, "Use the dedicated purchase action, which requires terms acceptance.");
  }

  const plan = await db.protectionPlan.findUnique({ where: { id } });
  if (!plan) return jsonError(404, "Protection Plan not found.");

  const transitionError = assertValidProtectionPlanTransition(plan.status, parsed.data.status);
  if (transitionError) return jsonError(409, transitionError);

  const isRefundApproval = parsed.data.status === "REFUND_APPROVED";

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.protectionPlan.update({
      where: { id },
      data: {
        status: parsed.data.status,
        decisionNote: parsed.data.note ?? plan.decisionNote,
        // No partial-refund tier specified anywhere for Protection Plan — a
        // full refund of the snapshotted price, unlike the service-level
        // refund rule engine.
        refundAmount: isRefundApproval ? plan.price : plan.refundAmount,
      },
    });
    await writeAudit(tx, {
      entityType: "ProtectionPlan",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `${plan.status} -> ${parsed.data.status}${parsed.data.note ? `: ${parsed.data.note}` : ""} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
