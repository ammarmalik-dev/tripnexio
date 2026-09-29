import type { NextRequest } from "next/server";
import { updateSubServiceSchema } from "@/lib/validation/sub-service-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Edit fields or toggle `active`. No delete — pricing rules may reference a sub-service. */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateSubServiceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const existing = await db.subService.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "Sub-service not found.");

    const nextServiceType = parsed.data.serviceType ?? existing.serviceType;
    const nextCode = parsed.data.code ?? existing.code;
    if (nextServiceType !== existing.serviceType || nextCode !== existing.code) {
      const duplicate = await db.subService.findUnique({
        where: { serviceType_code: { serviceType: nextServiceType, code: nextCode } },
      });
      if (duplicate && duplicate.id !== id) {
        return jsonError(400, "This code is already used for this service.", { code: ["Already used for this service."] });
      }
    }

    const changed = Object.keys(parsed.data).join(", ") || "nothing";
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.subService.update({ where: { id }, data: parsed.data });
      await writeAudit(tx, {
        entityType: "SubService",
        entityId: id,
        action: "UPDATE",
        byUserId: session.id,
        note:
          parsed.data.active !== undefined && parsed.data.active !== existing.active
            ? `Sub-service "${row.name}" ${row.active ? "enabled" : "disabled"} (by ${session.name})`
            : `Sub-service "${row.name}" updated: ${changed} (by ${session.name})`,
      });
      return row;
    });
    return jsonSuccess(updated);
  } catch {
    return jsonError(500, "Couldn't update this sub-service.");
  }
}
