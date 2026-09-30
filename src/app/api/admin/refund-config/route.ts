import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { updateRefundConfigSchema } from "@/lib/validation/refund-config-schema";
import { DEFAULT_REFUND_CONFIG, getRefundConfig } from "@/lib/refunds/config";
import { ServiceType } from "@/generated/prisma/enums";
import { withReason } from "@/lib/validation/sensitive-action";

/** Every service's current refund rule (stored row, or the locked default when none exists yet). */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const services = Object.values(ServiceType);
  const rows = await Promise.all(services.map(async (serviceType) => ({ serviceType, ...(await getRefundConfig(serviceType)) })));
  return jsonSuccess(rows);
}

/** Updates one service's refund rule — a sensitive admin action, so a reason is required and audited with old and new values. */
export async function PATCH(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = updateRefundConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }
  const { serviceType, reason, ...values } = parsed.data;

  const before = await getRefundConfig(serviceType);
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.refundConfig.upsert({
      where: { serviceType },
      update: values,
      create: { serviceType, ...values },
    });
    await writeAudit(tx, {
      entityType: "RefundConfig",
      entityId: serviceType,
      action: "UPDATE",
      byUserId: session.id,
      note: withReason(`Refund rule for ${serviceType}: ${JSON.stringify(before)} -> ${JSON.stringify(values)} (by ${session.name})`, reason),
    });
    return row;
  });

  return jsonSuccess({
    serviceType: updated.serviceType,
    fullRefundWindowHours: updated.fullRefundWindowHours,
    preValidationDeduction: Number(updated.preValidationDeduction),
    postValidationDeduction: Number(updated.postValidationDeduction),
    noRefundAfter: updated.noRefundAfter,
    defaults: DEFAULT_REFUND_CONFIG[serviceType],
  });
}
