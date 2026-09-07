import type { NextRequest } from "next/server";
import { updateTaxFeeConfigSchema } from "@/lib/validation/tax-fee-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { TAX_FEE_CONFIG_ID } from "@/lib/settings/tax-fee-config";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const config = await db.taxFeeConfig.findUnique({ where: { id: TAX_FEE_CONFIG_ID } });
  if (!config) return jsonError(404, "Tax/fee configuration not found — run the seed script.");

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

  const parsed = updateTaxFeeConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.taxFeeConfig.findUnique({ where: { id: TAX_FEE_CONFIG_ID } });
  if (!existing) return jsonError(404, "Tax/fee configuration not found — run the seed script.");

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.taxFeeConfig.update({ where: { id: TAX_FEE_CONFIG_ID }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "TaxFeeConfig",
      entityId: TAX_FEE_CONFIG_ID,
      action: "UPDATE",
      byUserId: session.id,
      note: `Tax/fee config updated: GST ${existing.gstRatePercent}% -> ${result.gstRatePercent}%, gateway fee ${existing.gatewayFeePercent}% -> ${result.gatewayFeePercent}% (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
