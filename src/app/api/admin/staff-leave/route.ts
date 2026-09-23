import type { NextRequest } from "next/server";
import { createStaffLeaveSchema } from "@/lib/validation/staff-leave-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

/**
 * Step 26 Unit 3 (audit §3.11/§4.7) — ADMIN.md §13's roster/leave model.
 * Gated by staff.manage (reused, not a new permission) — this is staff
 * roster data, the same category as the Admin Staff screen it complements.
 */
export async function GET() {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;

  const leaves = await db.staffLeave.findMany({
    include: { user: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } } },
    orderBy: { startDate: "desc" },
  });
  return jsonSuccess(leaves);
}

/**
 * Admin creating a leave entry directly for any staff member — this is the
 * decision, not a request awaiting one, so it's created straight into
 * APPROVED with the creating admin recorded as the approver. Contrast with
 * POST /api/staff-leave (Step 38), where a staff member requests their own
 * leave and it starts PENDING until someone with staff.leave.approve acts
 * on it.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createStaffLeaveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const staff = await db.user.findUnique({ where: { id: parsed.data.userId } });
  if (!staff) {
    return jsonError(400, "Select a valid staff member.", { userId: ["This staff member wasn't found."] });
  }

  const leave = await db.$transaction(async (tx) => {
    const created = await tx.staffLeave.create({
      data: {
        userId: parsed.data.userId,
        type: parsed.data.type,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        reason: parsed.data.reason,
        status: "APPROVED",
        approvedByUserId: session.id,
        approvedAt: new Date(),
      },
      include: { user: { select: { id: true, name: true } }, approvedBy: { select: { id: true, name: true } } },
    });
    await writeAudit(tx, {
      entityType: "StaffLeave",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Leave recorded for ${staff.name}: ${parsed.data.startDate} to ${parsed.data.endDate}${parsed.data.reason ? ` (${parsed.data.reason})` : ""} — auto-approved (recorded directly by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(leave, 201);
}
