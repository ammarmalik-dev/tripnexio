import type { Prisma, PricingRule } from "../../generated/prisma/client";

/** One JSON-safe value in a history snapshot (Decimals as numbers, dates as ISO strings). */
export type HistoryValue = string | number | boolean | null;
export type HistorySnapshot = Record<string, HistoryValue>;

/** The admin-editable PricingRule fields tracked by PricingRuleHistory (P23). */
export const PRICING_RULE_HISTORY_FIELDS = [
  "serviceType",
  "countryId",
  "subServiceId",
  "visaTypeId",
  "newVisaConfigId",
  "processingType",
  "paxType",
  "nationalityId",
  "nationality",
  "vendorCost",
  "sellingPrice",
  "additionalCharges",
  "validityFrom",
  "validityUntil",
  "active",
] as const satisfies readonly (keyof PricingRule)[];

type TrackedField = (typeof PRICING_RULE_HISTORY_FIELDS)[number];

function toHistoryValue(value: unknown): HistoryValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  // Prisma Decimal (or anything else numeric-like) — stored as a plain number.
  const asNumber = Number(String(value));
  return Number.isFinite(asNumber) ? asNumber : String(value);
}

export function pricingRuleSnapshot(rule: Pick<PricingRule, TrackedField>): HistorySnapshot {
  const snapshot: HistorySnapshot = {};
  for (const field of PRICING_RULE_HISTORY_FIELDS) snapshot[field] = toHistoryValue(rule[field]);
  return snapshot;
}

/**
 * old → new for only the fields that actually changed. A no-op save (nothing
 * changed) still gets a row, recording the full snapshot on both sides, so
 * "every update" is always traceable.
 */
export function diffSnapshots(before: HistorySnapshot, after: HistorySnapshot): { oldValues: HistorySnapshot; newValues: HistorySnapshot } {
  const oldValues: HistorySnapshot = {};
  const newValues: HistorySnapshot = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      oldValues[key] = before[key] ?? null;
      newValues[key] = after[key];
    }
  }
  if (Object.keys(newValues).length === 0) return { oldValues: before, newValues: after };
  return { oldValues, newValues };
}

export async function writePricingRuleHistory(
  tx: Prisma.TransactionClient,
  input: { pricingRuleId: string; action: "CREATE" | "UPDATE"; oldValues: HistorySnapshot | null; newValues: HistorySnapshot; userId: string }
) {
  await tx.pricingRuleHistory.create({
    data: {
      pricingRuleId: input.pricingRuleId,
      action: input.action,
      ...(input.oldValues ? { oldValues: input.oldValues } : {}),
      newValues: input.newValues,
      userId: input.userId,
    },
  });
}
