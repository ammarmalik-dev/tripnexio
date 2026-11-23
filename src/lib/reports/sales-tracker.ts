import { db } from "../db";
import type { ServiceType } from "../../generated/prisma/enums";

export interface SalesTrackerRow {
  userId: string | null;
  name: string;
  assignedLeads: number;
  totalLeads: number;
  convertedLeads: number;
  successfulPayments: number;
  revenue: number;
  conversionRate: number;
  targetConverted: number;
  targetRevenue: number;
  /** Converted vs target, %, null without a target. */
  convertedAchievement: number | null;
  revenueAchievement: number | null;
}

/** "YYYY-MM" months touched by [from, to]. */
export function monthsBetween(from: Date, to: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor <= to && months.length < 60) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

const pct = (value: number, of: number) => (of > 0 ? Math.round((value / of) * 1000) / 10 : null);

/**
 * Client doc 16 Nov (J9) — POC-wise sales performance for a period: assigned (open) leads, leads received, converted
 * leads, successful payments and revenue (payment totals, by payment date), conversion rate, and target vs.
 * achievement from the monthly targets of the months in the period. Quotation handling is not a sales metric.
 */
export async function buildSalesTracker(input: { from: Date; to: Date; serviceType?: ServiceType; staffId?: string }): Promise<{ rows: SalesTrackerRow[]; team: SalesTrackerRow; months: string[] }> {
  const { from, to } = input;
  const service = input.serviceType ? { serviceType: input.serviceType } : {};
  const staff = await db.user.findMany({
    where: { active: true, ...(input.staffId ? { id: input.staffId } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const months = monthsBetween(from, to);
  const targets = await db.salesTarget.findMany({ where: { month: { in: months }, userId: { in: staff.map((user) => user.id) } } });

  const rows: SalesTrackerRow[] = [];
  for (const user of staff) {
    const mine = { assignedStaffId: user.id, ...service };
    const assignedLeads = await db.lead.count({ where: { ...mine, status: { notIn: ["CONVERTED", "LOST", "CLOSED"] } } });
    const totalLeads = await db.lead.count({ where: { ...mine, createdAt: { gte: from, lte: to } } });
    const convertedLeads = await db.lead.count({ where: { ...mine, status: "CONVERTED", createdAt: { gte: from, lte: to } } });
    const payments = await db.payment.findMany({
      where: { status: "SUCCESS", updatedAt: { gte: from, lte: to }, booking: { lead: mine } },
      select: { amount: true, couponDiscount: true },
    });
    const revenue = Math.round(payments.reduce((sum, payment) => sum + Number(payment.amount) - Number(payment.couponDiscount ?? 0), 0) * 100) / 100;
    const own = targets.filter((target) => target.userId === user.id);
    const targetConverted = own.reduce((sum, target) => sum + target.targetConverted, 0);
    const targetRevenue = own.reduce((sum, target) => sum + Number(target.targetRevenue), 0);
    if (!input.staffId && totalLeads === 0 && assignedLeads === 0 && payments.length === 0 && own.length === 0) continue;
    rows.push({
      userId: user.id,
      name: user.name,
      assignedLeads,
      totalLeads,
      convertedLeads,
      successfulPayments: payments.length,
      revenue,
      conversionRate: pct(convertedLeads, totalLeads) ?? 0,
      targetConverted,
      targetRevenue,
      convertedAchievement: pct(convertedLeads, targetConverted),
      revenueAchievement: pct(revenue, targetRevenue),
    });
  }
  const sum = (key: keyof SalesTrackerRow) => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
  const team: SalesTrackerRow = {
    userId: null,
    name: "Team",
    assignedLeads: sum("assignedLeads"),
    totalLeads: sum("totalLeads"),
    convertedLeads: sum("convertedLeads"),
    successfulPayments: sum("successfulPayments"),
    revenue: Math.round(sum("revenue") * 100) / 100,
    conversionRate: pct(sum("convertedLeads"), sum("totalLeads")) ?? 0,
    targetConverted: sum("targetConverted"),
    targetRevenue: sum("targetRevenue"),
    convertedAchievement: pct(sum("convertedLeads"), sum("targetConverted")),
    revenueAchievement: pct(sum("revenue"), sum("targetRevenue")),
  };
  return { rows, team, months };
}
