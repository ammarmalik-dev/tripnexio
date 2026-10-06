import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { isVisaMasterKind, VISA_MASTER_CONFIG } from "@/lib/visa-masters/visa-masters";

interface RouteParams {
  params: Promise<{ kind: string; id: string }>;
}

/**
 * Edits a visa master row (name, days/description, order, enable/disable).
 * A stay type's days can't change while a New Visa product uses them — add a
 * new stay type instead, so existing products and prices keep their meaning.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { kind, id } = await params;
  if (!isVisaMasterKind(kind)) return jsonError(404, "Not found.");

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }
  const config = VISA_MASTER_CONFIG[kind];
  const parsed = config.update.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const data = parsed.data as Record<string, unknown>;

  try {
    const updated = await db.$transaction(async (tx) => {
      let row: { id: string; name: string } | null;
      if (kind === "stay-types") {
        const existing = await tx.visaStayType.findUnique({ where: { id } });
        if (!existing) return null;
        if (typeof data.days === "number" && data.days !== existing.days && (await tx.newVisaCountryConfig.count({ where: { stayDays: existing.days } })) > 0) {
          return { error: { days: ["New Visa products use this stay — add a new stay type instead of changing the days."] } };
        }
        row = await tx.visaStayType.update({ where: { id }, data });
      } else {
        if (!(await tx.visaValidityType.findUnique({ where: { id }, select: { id: true } }))) return null;
        row = await tx.visaValidityType.update({ where: { id }, data: { ...data, ...(data.description !== undefined ? { description: data.description || null } : {}) } });
      }
      await writeAudit(tx, {
        entityType: config.entityType,
        entityId: id,
        action: "UPDATE",
        byUserId: session.id,
        note: `${config.label} "${row.name}" updated (by ${session.name})`,
      });
      return { row };
    });
    if (!updated) return jsonError(404, "Not found.");
    if ("error" in updated) return jsonError(400, "Please check the highlighted fields.", updated.error);
    return jsonSuccess(updated.row);
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002") {
      return jsonError(400, "That name or value already exists.", { name: ["Already in the list."] });
    }
    console.error("[api/admin/visa-masters] update failed", error);
    return jsonError(500, "Couldn't save. Please try again.");
  }
}
