import type { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { configHistoryQuerySchema, dateRangeFilter } from "@/lib/validation/admin-monitoring-schemas";
import { CONFIG_ENTITY_TYPES, isConfigEntityType } from "@/lib/admin/monitoring";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import type { Prisma } from "@/generated/prisma/client";

/** Merging three newest-first streams needs page*pageSize rows from each; capped so a deep page can't pull thousands. */
const MAX_MERGE_WINDOW = 2000;

type HistorySource = "AUDIT" | "PRICING_RULE_HISTORY" | "VENDOR_RATE_HISTORY";

interface ConfigHistoryItem {
  id: string;
  source: HistorySource;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  action: string;
  summary: string | null;
  userId: string | null;
  userName: string | null;
  timestamp: Date;
}

function displayValue(value: Prisma.JsonValue | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** "field: old → new" for every key in newValues — both history tables store only the changed fields (or the full row on create). */
function summarizeChange(oldValues: Prisma.JsonValue | null, newValues: Prisma.JsonValue): string {
  const asRecord = (value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> =>
    value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Prisma.JsonValue>) : {};
  const before = asRecord(oldValues);
  const after = asRecord(newValues);
  const parts = Object.keys(after).map((key) =>
    key in before ? `${key}: ${displayValue(before[key])} → ${displayValue(after[key])}` : `${key}: ${displayValue(after[key])}`
  );
  const text = parts.join("; ");
  return text.length > 500 ? `${text.slice(0, 497)}…` : text;
}

/**
 * P24 item 7 — Admin → Configuration History: every configuration change,
 * newest first — AuditTrail rows for the config entity types
 * (CONFIG_ENTITY_TYPES) merged with the two structured history tables
 * (PricingRuleHistory, VendorRateHistory). Filtering by "PricingRule" /
 * "Vendor" includes that entity's structured history rows too.
 * Gated by `masters.manage` — the permission that edits these entities.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const parsed = configHistoryQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const q = parsed.data;
  if (q.entityType && !isConfigEntityType(q.entityType)) {
    return jsonError(400, "Unknown configuration entity type.", { entityType: ["Unknown configuration entity type."] });
  }
  const mergeWindow = q.page * q.pageSize;
  if (mergeWindow > MAX_MERGE_WINDOW) {
    return jsonError(400, "That page is too deep — narrow the filters (entity type, user, or date range) instead.");
  }

  const range = dateRangeFilter(q.dateFrom, q.dateTo);
  const includePricing = !q.entityType || q.entityType === "PricingRule";
  const includeVendorRates = !q.entityType || q.entityType === "Vendor";

  const auditWhere: Prisma.AuditTrailWhereInput = {
    entityType: q.entityType ? q.entityType : { in: [...CONFIG_ENTITY_TYPES] },
    ...(q.userId ? { byUserId: q.userId } : {}),
    ...(range ? { timestamp: range } : {}),
  };
  const pricingWhere: Prisma.PricingRuleHistoryWhereInput = {
    ...(q.userId ? { userId: q.userId } : {}),
    ...(range ? { createdAt: range } : {}),
  };
  const vendorWhere: Prisma.VendorRateHistoryWhereInput = {
    ...(q.userId ? { userId: q.userId } : {}),
    ...(range ? { createdAt: range } : {}),
  };

  try {
    const [auditTotal, auditRows, pricingTotal, pricingRows, vendorTotal, vendorRows] = await Promise.all([
      db.auditTrail.count({ where: auditWhere }),
      db.auditTrail.findMany({
        where: auditWhere,
        orderBy: { timestamp: "desc" },
        take: mergeWindow,
        select: { id: true, entityType: true, entityId: true, action: true, note: true, timestamp: true, byUser: { select: { id: true, name: true } } },
      }),
      includePricing ? db.pricingRuleHistory.count({ where: pricingWhere }) : Promise.resolve(0),
      includePricing
        ? db.pricingRuleHistory.findMany({ where: pricingWhere, orderBy: { createdAt: "desc" }, take: mergeWindow })
        : Promise.resolve([]),
      includeVendorRates ? db.vendorRateHistory.count({ where: vendorWhere }) : Promise.resolve(0),
      includeVendorRates
        ? db.vendorRateHistory.findMany({ where: vendorWhere, orderBy: { createdAt: "desc" }, take: mergeWindow })
        : Promise.resolve([]),
    ]);

    const merged: ConfigHistoryItem[] = [
      ...auditRows.map((row) => ({
        id: `audit:${row.id}`,
        source: "AUDIT" as const,
        entityType: row.entityType,
        entityId: row.entityId,
        entityLabel: null,
        action: row.action,
        summary: row.note,
        userId: row.byUser?.id ?? null,
        userName: row.byUser?.name ?? null,
        timestamp: row.timestamp,
      })),
      ...pricingRows.map((row) => ({
        id: `pricing:${row.id}`,
        source: "PRICING_RULE_HISTORY" as const,
        entityType: "PricingRule",
        entityId: row.pricingRuleId,
        entityLabel: null,
        action: row.action,
        summary: summarizeChange(row.oldValues, row.newValues),
        userId: row.userId,
        userName: null,
        timestamp: row.createdAt,
      })),
      ...vendorRows.map((row) => ({
        id: `vendor-rate:${row.id}`,
        source: "VENDOR_RATE_HISTORY" as const,
        entityType: "Vendor",
        entityId: row.vendorId,
        entityLabel: null,
        action: row.oldValues ? "RATE_UPDATE" : "RATE_CREATE",
        summary: `${SERVICE_TYPE_LABELS[row.service]} rate — ${summarizeChange(row.oldValues, row.newValues)}`,
        userId: row.userId,
        userName: null,
        timestamp: row.createdAt,
      })),
    ];

    merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const pageItems = merged.slice((q.page - 1) * q.pageSize, mergeWindow);

    // Resolve display names for just this page: history-table users (no
    // relation on those tables), vendor names, and pricing-rule labels.
    const userIds = Array.from(
      new Set(pageItems.filter((item) => !item.userName).map((item) => item.userId).filter((id): id is string => Boolean(id)))
    );
    const vendorIds = Array.from(new Set(pageItems.filter((item) => item.entityType === "Vendor").map((item) => item.entityId)));
    const pricingIds = Array.from(new Set(pageItems.filter((item) => item.entityType === "PricingRule").map((item) => item.entityId)));

    const [users, vendors, pricingRules] = await Promise.all([
      userIds.length ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      vendorIds.length ? db.vendor.findMany({ where: { id: { in: vendorIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
      pricingIds.length
        ? db.pricingRule.findMany({
            where: { id: { in: pricingIds } },
            select: { id: true, serviceType: true, paxType: true, processingType: true, country: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);
    const userNames = new Map(users.map((user) => [user.id, user.name]));
    const vendorNames = new Map(vendors.map((vendor) => [vendor.id, vendor.name]));
    const pricingLabels = new Map(
      pricingRules.map((rule) => [
        rule.id,
        [SERVICE_TYPE_LABELS[rule.serviceType], rule.country?.name, rule.processingType, rule.paxType].filter(Boolean).join(" · "),
      ])
    );

    const items = pageItems.map((item) => ({
      ...item,
      userName: item.userName ?? (item.userId ? (userNames.get(item.userId) ?? null) : null),
      entityLabel:
        item.entityType === "Vendor"
          ? (vendorNames.get(item.entityId) ?? null)
          : item.entityType === "PricingRule"
            ? (pricingLabels.get(item.entityId) ?? null)
            : null,
    }));

    return jsonSuccess({ items, total: auditTotal + pricingTotal + vendorTotal, page: q.page, pageSize: q.pageSize });
  } catch (error) {
    console.error("[api/admin/config-history]", error);
    return jsonError(500, "Couldn't load configuration history. Please try again.");
  }
}
