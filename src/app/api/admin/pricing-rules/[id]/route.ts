import type { NextRequest } from "next/server";
import { updatePricingRuleSchema } from "@/lib/validation/pricing-rule-schema";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { resolveNationalityInput } from "@/lib/nationalities/resolve";
import { validatePricingRuleProduct } from "@/lib/new-visa/validate-product-rule";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { diffSnapshots, pricingRuleSnapshot, writePricingRuleHistory } from "@/lib/pricing/rule-history";
import { validatePricingRuleRefs } from "@/lib/pricing/validate-rule-refs";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";

const ruleInclude = {
  country: { select: { id: true, name: true, code: true } },
  subService: { select: { id: true, code: true, name: true } },
  visaType: { select: { id: true, name: true } },
} as const;

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
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;

  const existing = await db.pricingRule.findUnique({ where: { id } });
  if (!existing) return jsonError(404, "Pricing rule not found.");

  if (parsed.data.countryId) {
    const country = await db.country.findUnique({ where: { id: parsed.data.countryId } });
    if (!country) return jsonError(400, "Country not found.", { countryId: ["Select a valid country."] });
  }
  if (parsed.data.newVisaConfigId !== undefined || parsed.data.countryId !== undefined) {
    const productError = await validatePricingRuleProduct({
      serviceType: parsed.data.serviceType ?? existing.serviceType,
      countryId: parsed.data.countryId !== undefined ? parsed.data.countryId : existing.countryId,
      newVisaConfigId: parsed.data.newVisaConfigId !== undefined ? parsed.data.newVisaConfigId : existing.newVisaConfigId,
    });
    if (productError) return productError;
  }
  const serviceChanged = parsed.data.serviceType !== undefined && parsed.data.serviceType !== existing.serviceType;
  const countryChanged = parsed.data.countryId !== undefined && parsed.data.countryId !== existing.countryId;
  const refsError = await validatePricingRuleRefs({
    serviceType: parsed.data.serviceType ?? existing.serviceType,
    countryId: parsed.data.countryId !== undefined ? parsed.data.countryId : existing.countryId,
    subServiceId: parsed.data.subServiceId !== undefined ? parsed.data.subServiceId : existing.subServiceId,
    visaTypeId: parsed.data.visaTypeId !== undefined ? parsed.data.visaTypeId : existing.visaTypeId,
    processingType: parsed.data.processingType !== undefined ? parsed.data.processingType : existing.processingType,
    checkSubService: serviceChanged || (parsed.data.subServiceId !== undefined && parsed.data.subServiceId !== existing.subServiceId),
    checkVisaType: countryChanged || (parsed.data.visaTypeId !== undefined && parsed.data.visaTypeId !== existing.visaTypeId),
    checkProcessingType:
      serviceChanged || (parsed.data.processingType !== undefined && parsed.data.processingType !== existing.processingType),
  });
  if (refsError) return refsError;
  const nationalityInput = await resolveNationalityInput(parsed.data);
  if (nationalityInput.error) return nationalityInput.error;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.pricingRule.update({
      where: { id },
      data: {
        ...parsed.data,
        ...nationalityInput.data,
        validityFrom: parsed.data.validityFrom !== undefined ? (parsed.data.validityFrom ? new Date(parsed.data.validityFrom) : null) : undefined,
        validityUntil: parsed.data.validityUntil !== undefined ? (parsed.data.validityUntil ? new Date(parsed.data.validityUntil) : null) : undefined,
      },
      include: ruleInclude,
    });
    const { oldValues, newValues } = diffSnapshots(pricingRuleSnapshot(existing), pricingRuleSnapshot(result));
    await writePricingRuleHistory(tx, { pricingRuleId: id, action: "UPDATE", oldValues, newValues, userId: session.id });
    await writeAudit(tx, {
      entityType: "PricingRule",
      entityId: id,
      action: "UPDATE",
      byUserId: session.id,
      note: withReason(`Pricing rule updated — selling ₹${result.sellingPrice} (by ${session.name})`, reason),
    });
    return result;
  });

  return jsonSuccess(updated);
}
