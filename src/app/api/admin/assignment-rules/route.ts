import type { NextRequest } from "next/server";
import { createAssignmentRuleSchema } from "@/lib/validation/assignment-rule-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { checkAssignmentRuleRefs } from "@/lib/staff/rule-refs";

/**
 * P24 — Admin → Assignment Rules (staff.manage). GET returns the rules plus
 * the sub-service and role options the form needs. The options are served
 * here rather than fetched from /api/admin/sub-services (masters.manage) and
 * /api/admin/roles (roles.manage) so a staff.manage-only admin can use this
 * screen without also needing those unrelated permissions.
 */
export async function GET() {
  const auth = await requirePermission("staff.manage");
  if (auth.error) return auth.error;

  try {
    const [rules, subServices, roles] = await Promise.all([
      db.assignmentRule.findMany({ orderBy: [{ serviceType: "asc" }, { priority: "desc" }, { createdAt: "asc" }] }),
      db.subService.findMany({
        orderBy: [{ serviceType: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
        select: { id: true, serviceType: true, name: true, active: true },
      }),
      db.role.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return jsonSuccess({ rules, subServices, roles });
  } catch (error) {
    console.error("[api/admin/assignment-rules] GET failed", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Couldn't load assignment rules.");
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

  const parsed = createAssignmentRuleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const refErrors = await checkAssignmentRuleRefs(parsed.data);
    if (refErrors) return jsonError(400, "Please check the highlighted fields.", refErrors);

    const created = await db.$transaction(async (tx) => {
      const row = await tx.assignmentRule.create({ data: parsed.data });
      await writeAudit(tx, {
        entityType: "AssignmentRule",
        entityId: row.id,
        action: "CREATE",
        byUserId: session.id,
        note:
          `Assignment rule added for ${row.serviceType}` +
          `${row.subServiceId ? ` (sub-service ${row.subServiceId})` : ""}` +
          `${row.roleId ? `, role ${row.roleId}` : ""}` +
          `${row.maxOpenLeads !== null ? `, max ${row.maxOpenLeads} open leads` : ""}` +
          `, priority ${row.priority} (by ${session.name})`,
      });
      return row;
    });
    return jsonSuccess(created, 201);
  } catch (error) {
    console.error("[api/admin/assignment-rules] POST failed", (error as { code?: string }).code ?? (error as Error).name);
    return jsonError(500, "Couldn't create this assignment rule.");
  }
}
