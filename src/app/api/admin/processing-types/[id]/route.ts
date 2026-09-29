import type { NextRequest } from "next/server";
import { updateProcessingTypeSchema } from "@/lib/validation/sub-service-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Edit label/description/order or toggle `active`. The code is fixed after
 * creation (stored on leads/pricing); a deactivated code disappears from the
 * customer forms and is rejected by the lead intake routes.
 */
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

  const parsed = updateProcessingTypeSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  try {
    const existing = await db.processingTypeOption.findUnique({ where: { id } });
    if (!existing) return jsonError(404, "Processing type not found.");

    const changed = Object.keys(parsed.data).join(", ") || "nothing";
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.processingTypeOption.update({ where: { id }, data: parsed.data });
      await writeAudit(tx, {
        entityType: "ProcessingTypeOption",
        entityId: id,
        action: "UPDATE",
        byUserId: session.id,
        note:
          parsed.data.active !== undefined && parsed.data.active !== existing.active
            ? `Processing type "${row.label}" (${row.serviceType}/${row.code}) ${row.active ? "enabled" : "disabled"} (by ${session.name})`
            : `Processing type "${row.label}" (${row.serviceType}/${row.code}) updated: ${changed} (by ${session.name})`,
      });
      return row;
    });
    return jsonSuccess(updated);
  } catch {
    return jsonError(500, "Couldn't update this processing type.");
  }
}
