import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { describeError } from "@/lib/api/describe-error";
import { pricingRuleSnapshot, writePricingRuleHistory } from "@/lib/pricing/rule-history";
import { unusedRuleMessage, usesPricingRules } from "@/lib/pricing/price-sources";
import { planPricingRuleCopy } from "@/lib/pricing/copy-rules";
import { sensitiveReasonSchema, withReason } from "@/lib/validation/sensitive-action";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { ServiceType } from "@/generated/prisma/enums";

const copySchema = z.object({
  serviceType: z.enum(ServiceType),
  sourceCountryId: z.string().min(1, "Choose the country to copy from"),
  targetCountryIds: z.array(z.string().min(1)).min(1, "Choose at least one country").max(300),
  /** Optional subset of the source country's rules; empty/absent = all of them. */
  ruleIds: z.array(z.string().min(1)).max(1000).optional(),
  /** true = only return the plan (what would be created / skipped), write nothing. */
  dryRun: z.boolean().optional(),
  reason: sensitiveReasonSchema.optional(),
});

/** A copy never creates more than this many rules in one request. */
const MAX_CREATES = 1000;
/** Three writes per rule — longer than Prisma's 5 s default for a large copy. */
const BULK_TRANSACTION_TIMEOUT_MS = 60_000;

/**
 * Admin handover §3/§4 — "Copy to other countries…" in the central pricing
 * control. `dryRun: true` previews; the real call (with the confirmation
 * reason) creates the planned rules with the source prices unchanged, one
 * PricingRuleHistory CREATE + one audit row per new rule. Existing rules for
 * the same combination are skipped and listed, never overwritten.
 */
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
  const parsed = copySchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const input = parsed.data;
  if (!input.dryRun && !input.reason) return jsonError(400, "Enter a reason for this action.", { reason: ["Enter a reason for this action."] });
  if (!usesPricingRules(input.serviceType)) return jsonError(400, unusedRuleMessage(input.serviceType));

  try {
    const plan = await planPricingRuleCopy(input);
    if ("error" in plan) return jsonError(400, plan.error);
    if (input.dryRun) return jsonSuccess({ ...plan, created: 0 });
    if (plan.creates.length === 0) return jsonError(400, "Nothing to copy — every chosen country already has these rules or can't take them.");
    if (plan.creates.length > MAX_CREATES) return jsonError(400, `That's ${plan.creates.length} rules — copy to fewer countries at a time (at most ${MAX_CREATES}).`);
    const reason = input.reason ?? "";

    const sourceRules = await db.pricingRule.findMany({ where: { id: { in: [...new Set(plan.creates.map((entry) => entry.sourceRuleId))] } } });
    const sourceById = new Map(sourceRules.map((rule) => [rule.id, rule]));

    const created = await db.$transaction(async (tx) => {
      let count = 0;
      for (const entry of plan.creates) {
        const source = sourceById.get(entry.sourceRuleId);
        if (!source) continue;
        const rule = await tx.pricingRule.create({
          data: {
            serviceType: source.serviceType,
            countryId: entry.targetCountryId,
            processingType: source.processingType,
            paxType: source.paxType,
            nationality: source.nationality,
            nationalityId: source.nationalityId,
            newVisaConfigId: entry.newVisaConfigId,
            subServiceId: source.subServiceId,
            visaTypeId: source.visaTypeId,
            vendorCost: source.vendorCost,
            sellingPrice: source.sellingPrice,
            additionalCharges: source.additionalCharges,
            governmentFee: source.governmentFee,
            validityFrom: source.validityFrom,
            validityUntil: source.validityUntil,
            active: source.active,
          },
        });
        await writePricingRuleHistory(tx, {
          pricingRuleId: rule.id,
          action: "CREATE",
          oldValues: null,
          newValues: pricingRuleSnapshot(rule),
          userId: session.id,
        });
        await writeAudit(tx, {
          entityType: "PricingRule",
          entityId: rule.id,
          action: "CREATE",
          byUserId: session.id,
          note: withReason(
            `Pricing rule copied: ${SERVICE_TYPE_LABELS[source.serviceType]} / ${entry.summary} from ${plan.sourceCountryName} to ${entry.targetCountryName} (source rule ${source.id}, by ${session.name})`,
            reason
          ),
        });
        count++;
      }
      return count;
    }, { timeout: BULK_TRANSACTION_TIMEOUT_MS });

    return jsonSuccess({ ...plan, created });
  } catch (error) {
    console.error("[api/admin/pricing-rules/copy] POST", describeError(error));
    return jsonError(500, "Couldn't copy the pricing rules.");
  }
}
