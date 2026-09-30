import type { NextRequest } from "next/server";
import { createEscalationRuleSchema } from "@/lib/validation/escalation-rule-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { checkEscalationRuleRefs } from "@/lib/staff/rule-refs";

/**
 * P24 — Admin → SLA Escalation (staff.manage). GET returns the rules plus
 * every active, non-terminal BOOKING-scope service status (the same rows
 * /api/admin/service-statuses manages) so the form can offer a per-service
 * status list without the separate masters.manage permission that route needs.
 */
export async function GET() {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;

  try {
    const [rules, statuses] = await Promise.all([
      db.escalationRule.findMany({ orderBy: [{ createdAt: "asc" }] }),
      db.serviceStatus.findMany({
        where: { scope: "BOOKING", isTerminal: false },
        orderBy: [{ serviceType: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
        select: { id: true, serviceType: true, name: true, active: true },
      }),
    ]);
    return jsonSuccess({ rules, statuses });
  } catch (error) {
    console.error("[api/admin/escalation-rules] GET failed", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Couldn't load escalation rules.");
  }
}

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

  const parsed = createEscalationRuleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const refErrors = await checkEscalationRuleRefs(parsed.data);
    if (refErrors) return jsonError(400, "Please check the highlighted fields.", refErrors);

    const created = await db.$transaction(async (tx) => {
      const row = await tx.escalationRule.create({ data: parsed.data });
      await writeAudit(tx, {
        entityType: "EscalationRule",
        entityId: row.id,
        action: "CREATE",
        byUserId: session.id,
        note:
          `SLA escalation rule added: ${row.serviceType ?? "any service"}, ` +
          `${row.serviceStatusId ? `status ${row.serviceStatusId}` : "any status"}, ` +
          `after ${row.hoursInStatus}h -> ${row.escalateTo} (by ${session.name})`,
      });
      return row;
    });
    return jsonSuccess(created, 201);
  } catch (error) {
    console.error("[api/admin/escalation-rules] POST failed", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Couldn't create this escalation rule.");
  }
}
