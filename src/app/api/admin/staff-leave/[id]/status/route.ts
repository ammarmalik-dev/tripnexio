import type { NextRequest } from "next/server";
import { leaveDecisionSchema } from "@/lib/validation/staff-leave-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { assertValidLeaveTransition } from "@/lib/staff-leave/transitions";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Step 38: the approve/reject action on a staff-requested leave. Separate
 * permission from staff.manage (same "raise vs. approve" split as
 * refunds.edit/refunds.approve) — the general Admin staff-roster
 * permission doesn't automatically also grant deciding leave requests.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("staff.leave.approve");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = leaveDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.staffLeave.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!existing) return jsonError(404, "Leave record not found.");

  const transitionError = assertValidLeaveTransition(existing.status, parsed.data.status);
  if (transitionError) {
    return jsonError(409, transitionError);
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.staffLeave.update({
      where: { id },
      data: { status: parsed.data.status, approvedByUserId: session.id, approvedAt: new Date() },
      include: { user: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } } },
    });
    await writeAudit(tx, {
      entityType: "StaffLeave",
      entityId: id,
      action: "STATUS_CHANGE",
      byUserId: session.id,
      note: `Leave for ${existing.user.name} ${parsed.data.status === "APPROVED" ? "approved" : "rejected"} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
