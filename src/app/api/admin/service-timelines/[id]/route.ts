import type { NextRequest } from "next/server";
import { updateServiceTimelineConfigSchema } from "@/lib/validation/service-timeline-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

  const parsed = updateServiceTimelineConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.serviceTimelineConfig.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Timeline configuration not found.");

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.serviceTimelineConfig.update({ where: { id }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "ServiceTimelineConfig",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Timeline/SLA config for ${result.serviceType} updated: doc verification ${result.documentVerificationHours ?? "not set"}h, expected completion ${result.expectedCompletionHours ?? "not set"}h, quotation response ${result.quotationResponseMinutes ?? "not set"}min, payment deadline ${result.paymentDeadlineHours ?? "not set"}h (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
