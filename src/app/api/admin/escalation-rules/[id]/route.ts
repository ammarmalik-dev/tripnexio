import type { NextRequest } from "next/server";
import { readDeleteReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";
import { updateEscalationRuleSchema } from "@/lib/validation/escalation-rule-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { checkEscalationRuleRefs } from "@/lib/staff/rule-refs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** P24 — edit fields or toggle `active` on an SLA escalation rule (staff.manage). */
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

  const parsed = updateEscalationRuleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const existing = await db.escalationRule.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "Escalation rule not found.");

    const serviceType = parsed.data.serviceType !== undefined ? parsed.data.serviceType : existing.serviceType;
    // A status belongs to one service — changing the service without re-picking the status clears it.
    const serviceStatusId =
      parsed.data.serviceStatusId !== undefined
        ? parsed.data.serviceStatusId
        : serviceType !== existing.serviceType
          ? null
          : existing.serviceStatusId;

    const refErrors = await checkEscalationRuleRefs({ serviceType, serviceStatusId });
    if (refErrors) return jsonError(400, "Please check the highlighted fields.", refErrors);

    const changed = Object.keys(parsed.data).join(", ") || "nothing";
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.escalationRule.update({ where: { id }, data: { ...parsed.data, serviceStatusId } });
      await writeAudit(tx, {
        entityType: "EscalationRule",
        entityId: id,
        action: "UPDATE",
        byUserId: session.id,
        note:
          parsed.data.active !== undefined && parsed.data.active !== existing.active
            ? `SLA escalation rule ${row.active ? "enabled" : "disabled"} (by ${session.name})`
            : `SLA escalation rule updated: ${changed} (by ${session.name})`,
      });
      return row;
    });
    return jsonSuccess(updated);
  } catch (error) {
    console.error("[api/admin/escalation-rules/[id]] PATCH failed", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Couldn't update this escalation rule.");
  }
}

/** Pure configuration — a real delete is safe (past escalations stay in the audit trail). */
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
    const existing = await db.escalationRule.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "Escalation rule not found.");

    await db.$transaction(async (tx) => {
      await tx.escalationRule.delete({ where: { id } });
      await writeAudit(tx, {
        entityType: "EscalationRule",
        entityId: id,
        action: "DELETE",
        byUserId: session.id,
        note: withReason(`SLA escalation rule (${existing.serviceType ?? "any service"}, ${existing.hoursInStatus}h -> ${existing.escalateTo}) deleted (by ${session.name})`, reason),
      });
    });
    return jsonSuccess({ id });
  } catch (error) {
    console.error("[api/admin/escalation-rules/[id]] DELETE failed", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Couldn't delete this escalation rule.");
  }
}
