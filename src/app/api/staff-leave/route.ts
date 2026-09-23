import type { NextRequest } from "next/server";
import { createOwnStaffLeaveSchema } from "@/lib/validation/staff-leave-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { getStaffSession } from "@/lib/auth/staff-session";

/**
 * Step 38: staff self-service leave requests — "Staff can apply for leave
 * from the CRM." Session-gated only, no specific permission (every active
 * staff member can request their own leave; approving it is a separate,
 * more restricted action — see /api/admin/staff-leave/[id]/status). `userId`
 * is always the signed-in staff member's own id, taken from the session,
 * never from the request body — a staff member can never submit a leave
 * request on someone else's behalf through this route.
 */
export async function GET() {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  const leaves = await db.staffLeave.findMany({
    where: { userId: session.id },
    include: { approvedBy: { select: { id: true, name: true } } },
    orderBy: { startDate: "desc" },
  });
  return jsonSuccess(leaves);
}

export async function POST(request: NextRequest) {
  const session = await getStaffSession();
  if (!session) return jsonError(401, "Sign in required.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createOwnStaffLeaveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const leave = await db.$transaction(async (tx) => {
    const created = await tx.staffLeave.create({
      data: {
        userId: session.id,
        type: parsed.data.type,
        startDate: new Date(parsed.data.startDate),
        endDate: new Date(parsed.data.endDate),
        reason: parsed.data.reason,
        status: "PENDING",
      },
      include: { approvedBy: { select: { id: true, name: true } } },
    });
    await writeAudit(tx, {
      entityType: "StaffLeave",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Leave requested by ${session.name}: ${parsed.data.startDate} to ${parsed.data.endDate}${parsed.data.reason ? ` (${parsed.data.reason})` : ""} — pending approval`,
    });
    return created;
  });

  return jsonSuccess(leave, 201);
}
