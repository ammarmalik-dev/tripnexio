import type { NextRequest } from "next/server";
import { createPricingRuleSchema } from "@/lib/validation/pricing-rule-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const rules = await db.pricingRule.findMany({ orderBy: [{ serviceType: "asc" }, { paxType: "asc" }] });
  return jsonSuccess(rules);
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;
  const { session } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Invalid request body.");
  }

  const parsed = createPricingRuleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const rule = await db.$transaction(async (tx) => {
    const created = await tx.pricingRule.create({ data: parsed.data });
    await writeAudit(tx, {
      entityType: "PricingRule",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Pricing rule created: ${created.serviceType} / ${created.paxType}${created.nationality ? ` / ${created.nationality}` : " / all nationalities"} — base ₹${created.basePrice} (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(rule, 201);
}
