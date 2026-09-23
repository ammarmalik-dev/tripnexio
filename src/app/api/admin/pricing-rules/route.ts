import type { NextRequest } from "next/server";
import { createPricingRuleSchema } from "@/lib/validation/pricing-rule-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";

export async function GET() {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const rules = await db.pricingRule.findMany({
    include: { country: { select: { id: true, name: true, code: true } } },
    orderBy: [{ serviceType: "asc" }, { country: { name: "asc" } }, { paxType: "asc" }],
  });
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

  if (parsed.data.countryId) {
    const country = await db.country.findUnique({ where: { id: parsed.data.countryId } });
    if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });
  }

  // No DB-level uniqueness on this combination (see the model's own doc
  // comment — nullable-column uniqueness semantics get messy in Postgres),
  // so an exact-match duplicate is checked here instead.
  const existing = await db.pricingRule.findFirst({
    where: {
      serviceType: parsed.data.serviceType,
      countryId: parsed.data.countryId ?? null,
      processingType: parsed.data.processingType ?? null,
      paxType: parsed.data.paxType,
      nationality: parsed.data.nationality ?? null,
    },
  });
  if (existing) {
    return jsonError(400, "A pricing rule already exists for this exact combination.", { paxType: ["Already configured — edit that rule instead."] });
  }

  const rule = await db.$transaction(async (tx) => {
    const created = await tx.pricingRule.create({
      data: {
        ...parsed.data,
        validityFrom: parsed.data.validityFrom ? new Date(parsed.data.validityFrom) : undefined,
        validityUntil: parsed.data.validityUntil ? new Date(parsed.data.validityUntil) : undefined,
      },
      include: { country: { select: { id: true, name: true, code: true } } },
    });
    await writeAudit(tx, {
      entityType: "PricingRule",
      entityId: created.id,
      action: "CREATE",
      byUserId: session.id,
      note: `Pricing rule created: ${created.serviceType} / ${created.paxType}${created.country ? ` / ${created.country.name}` : ""}${created.processingType ? ` / ${created.processingType}` : ""}${created.nationality ? ` / ${created.nationality}` : " / all nationalities"} — selling ₹${created.sellingPrice} (by ${session.name})`,
    });
    return created;
  });

  return jsonSuccess(rule, 201);
}
