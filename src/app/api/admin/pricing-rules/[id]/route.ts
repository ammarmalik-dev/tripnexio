import type { NextRequest } from "next/server";
import { updatePricingRuleSchema } from "@/lib/validation/pricing-rule-schema";
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

  const parsed = updatePricingRuleSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  }

  const existing = await db.pricingRule.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Pricing rule not found.");

  if (parsed.data.countryId) {
    const country = await db.country.findUnique({ where: { id: parsed.data.countryId } });
    if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.pricingRule.update({
      where: { id },
      data: {
        ...parsed.data,
        validityFrom: parsed.data.validityFrom !== undefined ? (parsed.data.validityFrom ? new Date(parsed.data.validityFrom) : null) : undefined,
        validityUntil: parsed.data.validityUntil !== undefined ? (parsed.data.validityUntil ? new Date(parsed.data.validityUntil) : null) : undefined,
      },
      include: { country: { select: { id: true, name: true, code: true } } },
    });
    await writeAudit(tx, {
      entityType: "PricingRule",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: `Pricing rule updated — selling ₹${result.sellingPrice} (by ${session.name})`,
    });
    return result;
  });

  return jsonSuccess(updated);
}
