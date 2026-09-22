import type { NextRequest } from "next/server";
import { updateOtbRuleConfigSchema } from "@/lib/validation/otb-rule-config-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { getOtbGlobalRules, OTB_RULE_CONFIG_ID } from "@/lib/otb/get-otb-rules";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  return jsonSuccess(await getOtbGlobalRules());
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

  const parsed = updateOtbRuleConfigSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  await db.$transaction(async (tx) => {
    await tx.otbRuleConfig.upsert({
      where: { id: OTB_RULE_CONFIG_ID },
      update: parsed.data,
      create: { id: OTB_RULE_CONFIG_ID, ...parsed.data },
    });
    await writeAudit(tx, {
      entityType: "OtbRuleConfig",
      entityId: OTB_RULE_CONFIG_ID,
      action: "UPDATE",
      byUserId: session.id,
      note: `OTB timelines set to standard ${parsed.data.standardProcessingDays} working days / urgent ${parsed.data.urgentProcessingHours ?? "not set"} working hours (by ${session.name})`,
    });
  });

  return jsonSuccess(await getOtbGlobalRules());
}
