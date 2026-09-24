import type { NextRequest } from "next/server";
import { updateReturnTicketRuleConfigSchema } from "@/lib/validation/return-ticket-rule-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { RETURN_TICKET_RULE_CONFIG_ID } from "@/lib/settings/return-ticket-rule-config";

/**
 * Step 42 — this config existed and was already consumed
 * (computeReturnDate) but had no Admin route/UI at all until now; a real
 * gap flagged during this step's exploration. Same GET/PATCH singleton
 * shape as tax-fee-config/protection-plan-config.
 */
export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const config = await db.returnTicketRuleConfig.findUnique({ where: { id: RETURN_TICKET_RULE_CONFIG_ID } });
  if (!config) return jsonError(404, "Return Ticket rule configuration not found — run the seed script.");

  return jsonSuccess(config);
}

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

  const parsed = updateReturnTicketRuleConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.returnTicketRuleConfig.findUnique({ where: { id: RETURN_TICKET_RULE_CONFIG_ID } });
  if (!existing) return jsonError(404, "Return Ticket rule configuration not found — run the seed script.");

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.returnTicketRuleConfig.update({ where: { id: RETURN_TICKET_RULE_CONFIG_ID }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "ReturnTicketRuleConfig",
      entityId: RETURN_TICKET_RULE_CONFIG_ID,
      action: "UPDATE",
      byUserId: session.id,
      note: `Return Ticket day offsets updated: 30-day ${existing.thirtyDayOffsetDays}->${result.thirtyDayOffsetDays}, 60-day ${existing.sixtyDayOffsetDays}->${result.sixtyDayOffsetDays}, 90-day ${existing.ninetyDayOffsetDays}->${result.ninetyDayOffsetDays} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
