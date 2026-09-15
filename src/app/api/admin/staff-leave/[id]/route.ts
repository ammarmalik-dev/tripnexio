import type { NextRequest } from "next/server";
import { updateStaffLeaveSchema } from "@/lib/validation/staff-leave-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateStaffLeaveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.staffLeave.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!existing) return jsonError(404, "Leave record not found.");

  const nextStart = parsed.data.startDate ? new Date(parsed.data.startDate) : existing.startDate;
  const nextEnd = parsed.data.endDate ? new Date(parsed.data.endDate) : existing.endDate;
  if (nextEnd < nextStart) {
    return jsonError(400, "End date must be on or after the start date.", { endDate: ["End date must be on or after the start date."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.staffLeave.update({
      where: { id },
      data: { startDate: nextStart, endDate: nextEnd, reason: parsed.data.reason },
      include: { user: { select: { id: true, name: true } } },
    });
    await writeAudit(tx, {
      entityType: "StaffLeave",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Leave for ${existing.user.name} updated (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;

  const existing = await db.staffLeave.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!existing) return jsonError(404, "Leave record not found.");

  await db.$transaction(async (tx) => {
    await tx.staffLeave.delete({ where: { id } });
    await writeAudit(tx, {
      entityType: "StaffLeave",
      entityId: id,
      action: "DELETE",
      byUserId: session.id,
      note: `Leave for ${existing.user.name} removed (by ${session.name})`,
    });
  });

  return jsonSuccess({ id });
}
