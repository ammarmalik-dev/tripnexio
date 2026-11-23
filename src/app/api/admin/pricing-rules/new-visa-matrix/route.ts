import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit/log";
import { requirePermission } from "@/lib/auth/require-permission";
import { pricingRuleSnapshot, writePricingRuleHistory } from "@/lib/pricing/rule-history";
import { readBodyReason } from "@/lib/api/sensitive-reason";
import { withReason } from "@/lib/validation/sensitive-action";

const cellSchema = z.object({
  /** null = an existing "every nationality" price (kept editable; new rows always name a nationality — F11). */
  nationalityId: z.string().min(1).nullable(),
  paxType: z.enum(["ADULT", "CHILD"]),
  processingType: z.string().min(1).max(40),
  /** null / empty = no price for this combination (an existing one is disabled). */
  sellingPrice: z.number().nonnegative().max(10_000_000).nullable(),
});

const matrixSchema = z.object({
  countryId: z.string().min(1, "Select a country"),
  newVisaConfigId: z.string().min(1, "Select the visa product"),
  cells: z.array(cellSchema).min(1, "Enter at least one price").max(800),
});

/**
 * Client doc 16 Nov (F9) — New Visa pricing in one form per visa product: every nationality × Adult / Child ×
 * processing type (Normal / Express) price at once. Each cell is one PricingRule (created, updated or disabled),
 * with its own history and audit row, all in one transaction. Requires a reason (sensitive price change).
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
  const parsed = matrixSchema.safeParse(body);
  if (!parsed.success) return jsonError(400, "Please check the highlighted fields.", parsed.error.flatten().fieldErrors);
  const reasonResult = readBodyReason(body);
  if (reasonResult.error) return reasonResult.error;
  const { reason } = reasonResult;
  const { countryId, newVisaConfigId, cells } = parsed.data;

  const product = await db.newVisaCountryConfig.findUnique({ where: { id: newVisaConfigId }, select: { countryId: true, country: { select: { name: true } } } });
  if (!product || product.countryId !== countryId) return jsonError(400, "That visa product isn't one of this country's.", { newVisaConfigId: ["Pick a product of this country."] });

  const processingCodes = new Set(
    (await db.processingTypeOption.findMany({ where: { serviceType: "NEW_VISA" }, select: { code: true } })).map((row) => row.code)
  );
  const unknownProcessing = cells.find((cell) => !processingCodes.has(cell.processingType));
  if (unknownProcessing) return jsonError(400, `Unknown processing type "${unknownProcessing.processingType}".`);

  const nationalityIds = [...new Set(cells.map((cell) => cell.nationalityId).filter((id): id is string => !!id))];
  const nationalities = await db.nationality.findMany({ where: { id: { in: nationalityIds } }, select: { id: true, name: true } });
  if (nationalities.length !== nationalityIds.length) return jsonError(400, "One of the nationalities wasn't found.");
  const nameOf = (id: string | null) => (id ? nationalities.find((row) => row.id === id)?.name ?? id : "every nationality");

  const counts = { created: 0, updated: 0, disabled: 0 };
  await db.$transaction(async (tx) => {
    for (const cell of cells) {
      const existing = await tx.pricingRule.findFirst({
        where: {
          serviceType: "NEW_VISA",
          countryId,
          newVisaConfigId,
          paxType: cell.paxType,
          processingType: cell.processingType,
          nationalityId: cell.nationalityId,
          ...(cell.nationalityId ? {} : { nationality: null }),
          subServiceId: null,
          visaTypeId: null,
        },
        orderBy: { active: "desc" },
      });
      const label = `New Visa / ${product.country.name} / ${nameOf(cell.nationalityId)} / ${cell.paxType} / ${cell.processingType}`;
      if (cell.sellingPrice === null) {
        if (!existing || !existing.active) continue;
        const updated = await tx.pricingRule.update({ where: { id: existing.id }, data: { active: false } });
        await writePricingRuleHistory(tx, { pricingRuleId: existing.id, action: "UPDATE", oldValues: pricingRuleSnapshot(existing), newValues: pricingRuleSnapshot(updated), userId: session.id });
        await writeAudit(tx, { entityType: "PricingRule", entityId: existing.id, action: "UPDATE", byUserId: session.id, note: withReason(`Price removed (disabled): ${label} (by ${session.name})`, reason) });
        counts.disabled++;
        continue;
      }
      if (existing) {
        if (existing.active && Number(existing.sellingPrice) === cell.sellingPrice) continue;
        const updated = await tx.pricingRule.update({ where: { id: existing.id }, data: { sellingPrice: cell.sellingPrice, active: true } });
        await writePricingRuleHistory(tx, { pricingRuleId: existing.id, action: "UPDATE", oldValues: pricingRuleSnapshot(existing), newValues: pricingRuleSnapshot(updated), userId: session.id });
        await writeAudit(tx, {
          entityType: "PricingRule",
          entityId: existing.id,
          action: "UPDATE",
          byUserId: session.id,
          note: withReason(`Price ${label}: ₹${existing.sellingPrice}${existing.active ? "" : " (disabled)"} → ₹${cell.sellingPrice} (by ${session.name})`, reason),
        });
        counts.updated++;
        continue;
      }
      const created = await tx.pricingRule.create({
        data: { serviceType: "NEW_VISA", countryId, newVisaConfigId, paxType: cell.paxType, processingType: cell.processingType, nationalityId: cell.nationalityId, nationality: cell.nationalityId ? nameOf(cell.nationalityId) : null, sellingPrice: cell.sellingPrice },
      });
      await writePricingRuleHistory(tx, { pricingRuleId: created.id, action: "CREATE", oldValues: null, newValues: pricingRuleSnapshot(created), userId: session.id });
      await writeAudit(tx, { entityType: "PricingRule", entityId: created.id, action: "CREATE", byUserId: session.id, note: withReason(`Price ${label}: ₹${cell.sellingPrice} (by ${session.name})`, reason) });
      counts.created++;
    }
  });

  return jsonSuccess(counts);
}
