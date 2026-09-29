import type { NextRequest } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import type { ServiceType } from "@/generated/prisma/enums";
import { jsonError, jsonSuccess } from "@/lib/api/respond";
import { describeError } from "@/lib/api/describe-error";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { pricingDashboardQuerySchema, type PricingRuleStatus } from "@/lib/validation/pricing-dashboard-query-schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPIRING_SOON_DAYS = 30;

/** Start of today (UTC) — validity dates are stored as date-only UTC midnights, so a rule valid "until today" is still in effect all day. */
function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function statusWhere(status: PricingRuleStatus, today: Date): Prisma.PricingRuleWhereInput {
  const notExpired: Prisma.PricingRuleWhereInput = { OR: [{ validityUntil: null }, { validityUntil: { gte: today } }] };
  const started: Prisma.PricingRuleWhereInput = { OR: [{ validityFrom: null }, { validityFrom: { lte: today } }] };
  switch (status) {
    case "inactive":
      return { active: false };
    case "expired":
      return { active: true, validityUntil: { lt: today } };
    case "upcoming":
      return { active: true, AND: [{ validityFrom: { gt: today } }, notExpired] };
    case "active":
      return { active: true, AND: [started, notExpired] };
  }
}

function statusOf(rule: { active: boolean; validityFrom: Date | null; validityUntil: Date | null }, today: Date): PricingRuleStatus {
  if (!rule.active) return "inactive";
  if (rule.validityUntil && rule.validityUntil < today) return "expired";
  if (rule.validityFrom && rule.validityFrom > today) return "upcoming";
  return "active";
}

/** Filter dropdown sources: countries, sub-services, visa types, and every processing code (master + any legacy code still on a rule). */
async function loadFilterOptions(processingOptions: { serviceType: ServiceType; code: string; label: string }[]) {
  // Sequential: small admin lookups, no need to hold several pooled connections at once.
  const countries = await db.country.findMany({ select: { id: true, name: true, active: true }, orderBy: { name: "asc" } });
  const subServices = await db.subService.findMany({
    select: { id: true, serviceType: true, name: true, active: true },
    orderBy: [{ serviceType: "asc" }, { displayOrder: "asc" }, { name: "asc" }],
  });
  const visaTypes = await db.visaType.findMany({ select: { id: true, name: true, countryId: true, active: true }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }] });
  const usedCodes = await db.pricingRule.findMany({
    where: { processingType: { not: null } },
    distinct: ["serviceType", "processingType"],
    select: { serviceType: true, processingType: true },
  });
  const processingTypes = processingOptions.map((option) => ({ serviceType: option.serviceType, code: option.code, label: option.label }));
  const known = new Set(processingTypes.map((option) => `${option.serviceType}:${option.code}`));
  for (const used of usedCodes) {
    if (used.processingType && !known.has(`${used.serviceType}:${used.processingType}`)) {
      processingTypes.push({ serviceType: used.serviceType, code: used.processingType, label: used.processingType });
    }
  }
  return { countries, subServices, visaTypes, processingTypes };
}

/**
 * P23 — Admin Pricing ("Quotation") Dashboard: every PricingRule with
 * filters, a computed validity status, and summary counts. Includes vendor
 * cost and margin — this is Admin-only (masters.manage), never a staff or
 * customer view. Summary counts respect the scope filters (country, service,
 * sub-service, visa type, processing type, active) but not the
 * status/effective-date/expiry filters, so the tiles always show the whole
 * picture for the chosen scope.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission("masters.manage");
  if (auth.error) return auth.error;

  const raw = Object.fromEntries([...new URL(request.url).searchParams.entries()].filter(([, value]) => value.trim() !== ""));
  const parsed = pricingDashboardQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError(400, "Invalid query parameters.", parsed.error.flatten().fieldErrors);
  }
  const query = parsed.data;

  try {
    const today = startOfTodayUtc();

    const scope: Prisma.PricingRuleWhereInput = {
      ...(query.countryId ? { countryId: query.countryId } : {}),
      ...(query.serviceType ? { serviceType: query.serviceType } : {}),
      ...(query.subServiceId ? { subServiceId: query.subServiceId } : {}),
      ...(query.visaTypeId ? { visaTypeId: query.visaTypeId } : {}),
      ...(query.processingType ? { processingType: query.processingType } : {}),
      ...(query.active ? { active: query.active === "true" } : {}),
    };

    const listConditions: Prisma.PricingRuleWhereInput[] = [scope];
    if (query.status) listConditions.push(statusWhere(query.status, today));
    if (query.effectiveDate) {
      const date = new Date(`${query.effectiveDate}T00:00:00.000Z`);
      listConditions.push({ OR: [{ validityFrom: null }, { validityFrom: { lte: date } }] });
      listConditions.push({ OR: [{ validityUntil: null }, { validityUntil: { gte: date } }] });
    }
    if (query.expiringWithinDays !== undefined) {
      listConditions.push({ validityUntil: { gte: today, lte: new Date(today.getTime() + query.expiringWithinDays * DAY_MS) } });
    }
    const where: Prisma.PricingRuleWhereInput = { AND: listConditions };

    // Sequential on purpose (seven small queries): avoids taking the whole connection pool for one admin screen.
    const total = await db.pricingRule.count({ where });
    const rows = await db.pricingRule.findMany({
        where,
        include: {
          country: { select: { id: true, name: true } },
          subService: { select: { id: true, name: true } },
          visaType: { select: { id: true, name: true } },
        },
        orderBy: [{ validityUntil: { sort: "asc", nulls: "last" } }, { serviceType: "asc" }, { createdAt: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
    });
    const activeCount = await db.pricingRule.count({ where: { AND: [scope, statusWhere("active", today)] } });
    const expiringSoonCount = await db.pricingRule.count({
      where: { AND: [scope, { active: true, validityUntil: { gte: today, lte: new Date(today.getTime() + EXPIRING_SOON_DAYS * DAY_MS) } }] },
    });
    const expiredCount = await db.pricingRule.count({ where: { AND: [scope, statusWhere("expired", today)] } });
    const upcomingCount = await db.pricingRule.count({ where: { AND: [scope, statusWhere("upcoming", today)] } });
    const scopeTotal = await db.pricingRule.count({ where: scope });

    // Processing labels: the Processing Types master where configured, else the raw code.
    const processingOptions = await db.processingTypeOption.findMany({
      select: { serviceType: true, code: true, label: true, active: true },
      orderBy: [{ serviceType: "asc" }, { displayOrder: "asc" }],
    });
    const processingLabel = new Map(processingOptions.map((option) => [`${option.serviceType}:${option.code}`, option.label]));

    const items = rows.map((rule) => {
      const vendorCost = Number(rule.vendorCost);
      const sellingPrice = Number(rule.sellingPrice);
      const additionalCharges = Number(rule.additionalCharges);
      const totalPrice = sellingPrice + additionalCharges;
      return {
        id: rule.id,
        serviceType: rule.serviceType,
        country: rule.country,
        subService: rule.subService,
        visaType: rule.visaType,
        processingType: rule.processingType,
        processingLabel: rule.processingType ? (processingLabel.get(`${rule.serviceType}:${rule.processingType}`) ?? rule.processingType) : null,
        paxType: rule.paxType,
        nationality: rule.nationality,
        sellingPrice,
        additionalCharges,
        totalPrice,
        vendorCost,
        margin: totalPrice - vendorCost,
        validityFrom: rule.validityFrom,
        validityUntil: rule.validityUntil,
        active: rule.active,
        status: statusOf(rule, today),
        updatedAt: rule.updatedAt,
      };
    });

    const options = query.includeOptions ? await loadFilterOptions(processingOptions) : null;

    return jsonSuccess({
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      summary: {
        total: scopeTotal,
        active: activeCount,
        expiringSoon: expiringSoonCount,
        expiringSoonDays: EXPIRING_SOON_DAYS,
        expired: expiredCount,
        upcoming: upcomingCount,
      },
      options,
    });
  } catch (error) {
    console.error("[api/admin/pricing-dashboard]", describeError(error));
    return jsonError(500, "Couldn't load the pricing dashboard. Please try again.");
  }
}
