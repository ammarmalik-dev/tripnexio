import { db } from "../db";
import { SERVICE_TYPE_LABELS, BOOKING_STATUS_LABELS, REFUND_STATUS_LABELS } from "./labels";
import type { BookingStatus, LeadStatus, RefundStatus, ServiceType } from "../../generated/prisma/enums";

/**
 * P22 item 3 — CRM.md §29 "Reports" for CRM staff (/crm/reports).
 *
 * `serviceScope` is the output of `serviceTypeCondition(session)` from
 * src/lib/auth/service-scope.ts (`{}` when unrestricted, `{ serviceType:
 * { in: [...] } }` when scoped) — every query below nests it under the
 * right relation, so a service-scoped staff member never sees out-of-scope
 * volume. Queries run sequentially with narrow `select`s / `groupBy`s (no
 * deep includes) — same connection-pool reasoning as src/lib/crm/dashboard.ts.
 *
 * Period conventions (same as the existing reports, disclosed in the UI):
 * - Leads and bookings: by their own createdAt.
 * - Revenue collected: SUCCESS payments by updatedAt (Payment has no
 *   succeeded-at column — same convention as the Admin Revenue/P&L reports).
 * - Refunds: by Refund.createdAt (same as the Admin Refund Report).
 * - Staff workload: a live snapshot of currently-open work, not period-filtered.
 *
 * Vendor cost / margin (CRM.md §29 "Internal-only") are computed ONLY when
 * `includeFinance` is true (the route passes `hasPermission(finance.manage)`)
 * — otherwise the query never runs and `finance` is `null` in the payload.
 */

export type ServiceScopeCondition = { serviceType?: ServiceType | { in: ServiceType[] } };

export interface ReportsPeriod {
  from: Date;
  to: Date;
}

export interface CountAmountRow {
  key: string;
  label: string;
  count: number;
  amount: number;
}

export interface ConversionRow {
  key: string;
  label: string;
  leads: number;
  qualified: number;
  converted: number;
  /** 0-100, one decimal; null when there are no leads. */
  conversionPercent: number | null;
}

export interface ServiceMixRow {
  serviceType: ServiceType;
  label: string;
  bookings: number;
  bookingSharePercent: number;
  revenue: number;
  revenueSharePercent: number;
}

export interface StaffWorkloadRow {
  staffId: string;
  name: string;
  active: boolean;
  openLeads: number;
  openBookings: number;
  openTasks: number;
  /** Passengers on this staff member's open bookings (via the booking's lead assignee). */
  pax: number;
}

export interface FinanceByServiceRow {
  serviceType: ServiceType;
  label: string;
  bookings: number;
  sellingPrice: number;
  vendorCost: number;
  margin: number;
}

export interface CrmReports {
  range: { from: string; to: string };
  kpis: {
    leads: number;
    qualifiedLeads: number;
    convertedLeads: number;
    conversionPercent: number | null;
    bookings: number;
    completedBookings: number;
    cancelledBookings: number;
    revenueCollected: number;
    successfulPayments: number;
    refundCount: number;
    refundAmount: number;
  };
  bookingsByService: CountAmountRow[];
  bookingsByStatus: CountAmountRow[];
  conversionByService: ConversionRow[];
  conversionBySource: ConversionRow[];
  refunds: {
    count: number;
    amount: number;
    completedAmount: number;
    byStatus: CountAmountRow[];
    byService: CountAmountRow[];
  };
  serviceMix: ServiceMixRow[];
  staffWorkload: StaffWorkloadRow[];
  /** Internal-only (finance.manage) — null for everyone else; never computed for them. */
  finance: {
    vendorCost: number;
    sellingPrice: number;
    margin: number;
    byService: FinanceByServiceRow[];
  } | null;
}

/** Leads at or past "Qualified" in the pipeline (same stage tiers as buildConversionFunnel in dashboard.ts). */
const QUALIFIED_OR_LATER: LeadStatus[] = ["QUALIFIED", "QUOTATION_CREATED", "QUOTATION_ACCEPTED", "PAYMENT_PENDING", "CONVERTED"];
const TERMINAL_LEAD_STATUSES: LeadStatus[] = ["CONVERTED", "LOST", "CLOSED"];
const OPEN_BOOKING_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED", "PROCESSING"];
const UNKNOWN_SOURCE = "Not recorded";

const toNumber = (value: { toString(): string } | null | undefined): number => (value ? Number(value.toString()) : 0);
const round2 = (value: number) => Math.round(value * 100) / 100;
const percent = (part: number, whole: number): number | null => (whole === 0 ? null : Math.round((part / whole) * 1000) / 10);
const share = (part: number, whole: number): number => percent(part, whole) ?? 0;

function bump(map: Map<string, CountAmountRow>, key: string, label: string, amount = 0) {
  const row = map.get(key);
  if (row) {
    row.count += 1;
    row.amount += amount;
  } else {
    map.set(key, { key, label, count: 1, amount });
  }
}

function finalizeRows(map: Map<string, CountAmountRow>): CountAmountRow[] {
  return [...map.values()].map((row) => ({ ...row, amount: round2(row.amount) })).sort((a, b) => b.count - a.count || b.amount - a.amount);
}

function buildConversionRows(groups: { key: string; label: string; status: LeadStatus; count: number }[]): ConversionRow[] {
  const rows = new Map<string, ConversionRow>();
  for (const g of groups) {
    const row = rows.get(g.key) ?? { key: g.key, label: g.label, leads: 0, qualified: 0, converted: 0, conversionPercent: null };
    row.leads += g.count;
    if (QUALIFIED_OR_LATER.includes(g.status)) row.qualified += g.count;
    if (g.status === "CONVERTED") row.converted += g.count;
    rows.set(g.key, row);
  }
  return [...rows.values()].map((row) => ({ ...row, conversionPercent: percent(row.converted, row.leads) })).sort((a, b) => b.leads - a.leads);
}

export async function getCrmReports(input: { period: ReportsPeriod; serviceScope: ServiceScopeCondition; includeFinance: boolean }): Promise<CrmReports> {
  const { period, serviceScope, includeFinance } = input;
  const inPeriod = { gte: period.from, lte: period.to };
  const scoped = Object.keys(serviceScope).length > 0;
  const leadRelation = scoped ? { lead: serviceScope } : {};

  // --- Leads: two small groupBys (service x status, source x status). ---
  const leadServiceGroups = await db.lead.groupBy({
    by: ["serviceType", "status"],
    where: { createdAt: inPeriod, ...serviceScope },
    _count: { _all: true },
  });
  const leadSourceGroups = await db.lead.groupBy({
    by: ["source", "status"],
    where: { createdAt: inPeriod, ...serviceScope },
    _count: { _all: true },
  });

  const conversionByService = buildConversionRows(
    leadServiceGroups.map((g) => ({ key: g.serviceType, label: SERVICE_TYPE_LABELS[g.serviceType], status: g.status, count: g._count._all }))
  );
  const conversionBySource = buildConversionRows(
    leadSourceGroups.map((g) => {
      const source = g.source?.trim() ? g.source.trim() : UNKNOWN_SOURCE;
      return { key: source, label: source, status: g.status, count: g._count._all };
    })
  );
  const leads = conversionByService.reduce((sum, r) => sum + r.leads, 0);
  const qualifiedLeads = conversionByService.reduce((sum, r) => sum + r.qualified, 0);
  const convertedLeads = conversionByService.reduce((sum, r) => sum + r.converted, 0);

  // --- Bookings created in the period (flat select; groupBy can't group by a relation field). ---
  const bookings = await db.booking.findMany({
    where: { createdAt: inPeriod, ...leadRelation },
    select: { status: true, lead: { select: { serviceType: true } } },
  });
  const bookingsByServiceMap = new Map<string, CountAmountRow>();
  const bookingsByStatusMap = new Map<string, CountAmountRow>();
  for (const booking of bookings) {
    bump(bookingsByServiceMap, booking.lead.serviceType, SERVICE_TYPE_LABELS[booking.lead.serviceType]);
    bump(bookingsByStatusMap, booking.status, BOOKING_STATUS_LABELS[booking.status]);
  }

  // --- Revenue collected (SUCCESS payments). ---
  const payments = await db.payment.findMany({
    where: { status: "SUCCESS", updatedAt: inPeriod, ...(scoped ? { booking: leadRelation } : {}) },
    select: { amount: true, booking: { select: { lead: { select: { serviceType: true } } } } },
  });
  const revenueByService = new Map<ServiceType, number>();
  let revenueCollected = 0;
  for (const payment of payments) {
    const amount = toNumber(payment.amount);
    revenueCollected += amount;
    const serviceType = payment.booking.lead.serviceType;
    revenueByService.set(serviceType, (revenueByService.get(serviceType) ?? 0) + amount);
  }

  // --- Refunds raised in the period. ---
  const refunds = await db.refund.findMany({
    where: { createdAt: inPeriod, ...(scoped ? { payment: { booking: leadRelation } } : {}) },
    select: { status: true, refundAmount: true, payment: { select: { booking: { select: { lead: { select: { serviceType: true } } } } } } },
  });
  const refundsByStatusMap = new Map<string, CountAmountRow>();
  const refundsByServiceMap = new Map<string, CountAmountRow>();
  let refundAmount = 0;
  let refundCompletedAmount = 0;
  for (const refund of refunds) {
    const amount = toNumber(refund.refundAmount);
    const status: RefundStatus = refund.status;
    const serviceType = refund.payment.booking.lead.serviceType;
    refundAmount += amount;
    if (status === "COMPLETED") refundCompletedAmount += amount;
    bump(refundsByStatusMap, status, REFUND_STATUS_LABELS[status], amount);
    bump(refundsByServiceMap, serviceType, SERVICE_TYPE_LABELS[serviceType], amount);
  }

  // --- Service mix: share of bookings and of revenue per service. ---
  const mixServices = new Set<ServiceType>([...bookings.map((b) => b.lead.serviceType), ...revenueByService.keys()]);
  const serviceMix: ServiceMixRow[] = [...mixServices]
    .map((serviceType) => {
      const serviceBookings = bookingsByServiceMap.get(serviceType)?.count ?? 0;
      const revenue = revenueByService.get(serviceType) ?? 0;
      return {
        serviceType,
        label: SERVICE_TYPE_LABELS[serviceType],
        bookings: serviceBookings,
        bookingSharePercent: share(serviceBookings, bookings.length),
        revenue: round2(revenue),
        revenueSharePercent: share(revenue, revenueCollected),
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.bookings - a.bookings);

  // --- Staff workload (live snapshot). ---
  const openLeadGroups = await db.lead.groupBy({
    by: ["assignedStaffId"],
    where: { assignedStaffId: { not: null }, status: { notIn: TERMINAL_LEAD_STATUSES }, ...serviceScope },
    _count: { _all: true },
  });
  const openBookings = await db.booking.findMany({
    where: { status: { in: OPEN_BOOKING_STATUSES }, lead: { assignedStaffId: { not: null }, ...serviceScope } },
    select: { lead: { select: { assignedStaffId: true } }, _count: { select: { passengers: true } } },
  });
  const openTaskGroups = await db.task.groupBy({
    by: ["assignedToId"],
    where: { assignedToId: { not: null }, status: { in: ["OPEN", "IN_PROGRESS"] }, ...serviceScope },
    _count: { _all: true },
  });

  const workload = new Map<string, Omit<StaffWorkloadRow, "name" | "active">>();
  const workloadRow = (staffId: string) => {
    const existing = workload.get(staffId);
    if (existing) return existing;
    const created = { staffId, openLeads: 0, openBookings: 0, openTasks: 0, pax: 0 };
    workload.set(staffId, created);
    return created;
  };
  for (const g of openLeadGroups) if (g.assignedStaffId) workloadRow(g.assignedStaffId).openLeads += g._count._all;
  for (const b of openBookings) {
    if (!b.lead.assignedStaffId) continue;
    const row = workloadRow(b.lead.assignedStaffId);
    row.openBookings += 1;
    row.pax += b._count.passengers;
  }
  for (const g of openTaskGroups) if (g.assignedToId) workloadRow(g.assignedToId).openTasks += g._count._all;

  const staffUsers = workload.size
    ? await db.user.findMany({ where: { id: { in: [...workload.keys()] } }, select: { id: true, name: true, active: true } })
    : [];
  const staffById = new Map(staffUsers.map((u) => [u.id, u]));
  const staffWorkload: StaffWorkloadRow[] = [...workload.values()]
    .map((row) => ({ ...row, name: staffById.get(row.staffId)?.name ?? "Unknown staff", active: staffById.get(row.staffId)?.active ?? false }))
    .sort((a, b) => b.openLeads + b.openBookings + b.openTasks - (a.openLeads + a.openBookings + a.openTasks));

  // --- Internal-only finance (finance.manage). Never queried otherwise. ---
  let finance: CrmReports["finance"] = null;
  if (includeFinance) {
    // The selected quotation of every lead with a non-cancelled booking created in the period.
    const selected = await db.quotation.findMany({
      where: {
        isSelected: true,
        lead: { ...serviceScope, bookings: { some: { createdAt: inPeriod, status: { not: "CANCELLED" } } } },
      },
      select: { vendorCost: true, sellingPrice: true, margin: true, lead: { select: { serviceType: true } } },
    });
    const byService = new Map<ServiceType, FinanceByServiceRow>();
    let vendorCost = 0;
    let sellingPrice = 0;
    let margin = 0;
    for (const q of selected) {
      const cost = toNumber(q.vendorCost);
      const price = toNumber(q.sellingPrice);
      const qMargin = toNumber(q.margin);
      vendorCost += cost;
      sellingPrice += price;
      margin += qMargin;
      const serviceType = q.lead.serviceType;
      const row = byService.get(serviceType) ?? { serviceType, label: SERVICE_TYPE_LABELS[serviceType], bookings: 0, sellingPrice: 0, vendorCost: 0, margin: 0 };
      row.bookings += 1;
      row.sellingPrice += price;
      row.vendorCost += cost;
      row.margin += qMargin;
      byService.set(serviceType, row);
    }
    finance = {
      vendorCost: round2(vendorCost),
      sellingPrice: round2(sellingPrice),
      margin: round2(margin),
      byService: [...byService.values()]
        .map((row) => ({ ...row, sellingPrice: round2(row.sellingPrice), vendorCost: round2(row.vendorCost), margin: round2(row.margin) }))
        .sort((a, b) => b.margin - a.margin),
    };
  }

  return {
    range: { from: period.from.toISOString(), to: period.to.toISOString() },
    kpis: {
      leads,
      qualifiedLeads,
      convertedLeads,
      conversionPercent: percent(convertedLeads, leads),
      bookings: bookings.length,
      completedBookings: bookingsByStatusMap.get("COMPLETED")?.count ?? 0,
      cancelledBookings: bookingsByStatusMap.get("CANCELLED")?.count ?? 0,
      revenueCollected: round2(revenueCollected),
      successfulPayments: payments.length,
      refundCount: refunds.length,
      refundAmount: round2(refundAmount),
    },
    bookingsByService: finalizeRows(bookingsByServiceMap),
    bookingsByStatus: finalizeRows(bookingsByStatusMap),
    conversionByService,
    conversionBySource,
    refunds: {
      count: refunds.length,
      amount: round2(refundAmount),
      completedAmount: round2(refundCompletedAmount),
      byStatus: finalizeRows(refundsByStatusMap),
      byService: finalizeRows(refundsByServiceMap),
    },
    serviceMix,
    staffWorkload,
    finance,
  };
}
