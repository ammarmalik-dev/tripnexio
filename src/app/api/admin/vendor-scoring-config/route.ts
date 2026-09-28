import type { NextRequest } from "next/server";
import { updateVendorScoringConfigSchema } from "@/lib/validation/vendor-scoring-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { VENDOR_SCORING_CONFIG_ID } from "@/lib/vendors/scoring";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const config = await db.vendorScoringConfig.findUnique({ where: { id: VENDOR_SCORING_CONFIG_ID } });
  if (!config) return jsonError(404, "Vendor scoring configuration not found — run the seed script.");

  return jsonSuccess(config);
}

/** Business Rules §14 "Sensitive Admin Actions" — "change important workflow/status configuration" covers this weighting change; requires the ConfirmActionDialog's typed reason, folded into the audit note. */
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

  const { reason, ...rest } = (body as Record<string, unknown>) ?? {};
  if (typeof reason !== "string" || reason.trim().length < 5) {
    return jsonError(400, "Enter a reason (at least 5 characters).", { reason: ["Enter a reason (at least 5 characters)."] });
  }

  const parsed = updateVendorScoringConfigSchema.safeParse(rest);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.vendorScoringConfig.findUnique({ where: { id: VENDOR_SCORING_CONFIG_ID } });
  if (!existing) return jsonError(404, "Vendor scoring configuration not found — run the seed script.");

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.vendorScoringConfig.update({ where: { id: VENDOR_SCORING_CONFIG_ID }, data: parsed.data });
    await writeAudit(tx, {
      entityType: "VendorScoringConfig",
      entityId: VENDOR_SCORING_CONFIG_ID,
      action: "UPDATE",
      byUserId: session.id,
      note: `Weights updated: suitability ${existing.serviceSuitabilityWeight}->${result.serviceSuitabilityWeight}, processing time ${existing.processingTimeWeight}->${result.processingTimeWeight}, performance ${existing.performanceWeight}->${result.performanceWeight}, reliability ${existing.reliabilityWeight}->${result.reliabilityWeight} (by ${session.name}). Reason: ${reason.trim()}`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
