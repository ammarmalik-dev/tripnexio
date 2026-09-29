import type { NextRequest } from "next/server";
import { updateProtectionPlanStatusSchema } from "@/lib/validation/protection-plan-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { autoCompleteTasksForEntity } from "@/lib/tasks/create-task";
import {
  assertValidProtectionPlanTransition,
  NOTE_REQUIRED_PROTECTION_PLAN_STATUSES,
  SYSTEM_ONLY_PROTECTION_PLAN_STATUSES,
} from "@/lib/protection-plan/transitions";
import { openEligibilityReview, openRefundReview } from "@/lib/protection-plan/lifecycle";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Staff-set Protection Plan statuses (P12): flag for eligibility review
 * (opens the "Protection Plan Review" task), decide Eligible / Ineligible
 * with a note (closes it), send to refund review, or cancel. Purchase comes
 * only from a paid payment and every refund status only from the refund
 * decision (PATCH .../refund-decision) and the Refund it raises.
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
  const { status: nextStatus, note } = parsed.data;
  if (SYSTEM_ONLY_PROTECTION_PLAN_STATUSES.includes(nextStatus)) {
    return jsonError(400, "This status is set automatically (payment or refund decision), not by hand.");
  }
  if (NOTE_REQUIRED_PROTECTION_PLAN_STATUSES.includes(nextStatus) && !note) {
    return jsonError(400, "Add a note explaining this decision.", { note: ["A note is required."] });
  }

  const plan = await db.protectionPlan.findUnique({ where: { id }, include: { booking: { select: { id: true, leadId: true } } } });
  if (!plan) return jsonError(404, "Protection Plan not found.");

  if (plan.status === nextStatus) return jsonError(409, "The Protection Plan is already in this status.");
  const transitionError = assertValidProtectionPlanTransition(plan.status, nextStatus);
  if (transitionError) return jsonError(409, transitionError);

  const actor = { byUserId: session.id, label: `by ${session.name}` };
  const updated = await db.$transaction(async (tx) => {
    if (nextStatus === "UNDER_ELIGIBILITY_REVIEW") {
      await openEligibilityReview(tx, plan, `Staff flag: ${note}`, actor);
    } else if (nextStatus === "REFUND_UNDER_REVIEW") {
      await openRefundReview(tx, plan, note ?? "Refund review", actor);
    } else {
      await tx.protectionPlan.update({ where: { id }, data: { status: nextStatus, decisionNote: note ?? plan.decisionNote } });
      await writeAudit(tx, {
        entityType: "ProtectionPlan",
        entityId: id,
        action: "STATUS_CHANGE",
        byUserId: session.id,
        note: `${plan.status} -> ${nextStatus}${note ? `: ${note}` : ""} (by ${session.name})`,
      });
      if (nextStatus === "ELIGIBLE" || nextStatus === "INELIGIBLE") {
        await autoCompleteTasksForEntity(tx, "ProtectionPlan", id, `Eligibility decided: ${nextStatus} (by ${session.name})`);
      }
    }
    return tx.protectionPlan.findUniqueOrThrow({ where: { id } });
  });

  return jsonSuccess(updated);
}
