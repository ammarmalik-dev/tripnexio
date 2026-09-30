import type { NextRequest } from "next/server";
import { readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { updateAssignmentRuleSchema } from "@/lib/validation/assignment-rule-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { checkAssignmentRuleRefs } from "@/lib/staff/rule-refs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** P24 — edit fields or toggle `active` on an assignment rule (staff.manage). */
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

  const parsed = updateAssignmentRuleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const existing = await db.assignmentRule.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "Assignment rule not found.");

    const serviceType = parsed.data.serviceType ?? existing.serviceType;
    // Changing the service without re-picking the sub-service would leave a mismatched one — clear it.
    const subServiceId =
      parsed.data.subServiceId !== undefined
        ? parsed.data.subServiceId
        : serviceType !== existing.serviceType
          ? null
          : existing.subServiceId;
    const roleId = parsed.data.roleId !== undefined ? parsed.data.roleId : existing.roleId;

    const refErrors = await checkAssignmentRuleRefs({ serviceType, subServiceId, roleId });
    if (refErrors) return jsonError(400, "Please check the highlighted fields.", refErrors);

    const changed = Object.keys(parsed.data).join(", ") || "nothing";
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.assignmentRule.update({ where: { id }, data: { ...parsed.data, subServiceId } });
      await writeAudit(tx, {
        entityType: "AssignmentRule",
        entityId: id,
        action: "UPDATE",
        byUserId: session.id,
        note:
          parsed.data.active !== undefined && parsed.data.active !== existing.active
            ? `Assignment rule for ${row.serviceType} ${row.active ? "enabled" : "disabled"} (by ${session.name})`
            : `Assignment rule for ${row.serviceType} updated: ${changed} (by ${session.name})`,
      });
      return row;
    });
    return jsonSuccess(updated);
  } catch (error) {
    console.error("[api/admin/assignment-rules/[id]] PATCH failed", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Couldn't update this assignment rule.");
  }
}

/** Rules are pure configuration (nothing references them), so a real delete is safe. */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;
  // P24 - Locked Q14: deleting a record needs a reason.
  const reasonResult = await readDeleteReason(request);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  try {
    const existing = await db.assignmentRule.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "Assignment rule not found.");

    await db.$transaction(async (tx) => {
      await tx.assignmentRule.delete({ where: { id } });
      await writeAudit(tx, {
        entityType: "AssignmentRule",
        entityId: id,
        action: "DELETE",
        byUserId: session.id,
        note: withReason(`Assignment rule for ${existing.serviceType} (priority ${existing.priority}) deleted (by ${session.name})`, reason),
      });
    });
    return jsonSuccess({ id });
  } catch (error) {
    console.error("[api/admin/assignment-rules/[id]] DELETE failed", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Couldn't delete this assignment rule.");
  }
}
