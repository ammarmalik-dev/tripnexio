import { db } from "../db";
import { runSequentially } from "../db-sequential";
import { buildManagementReport } from "../reports/management";
import { getGoLiveChecks } from "./go-live-checks";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * Client corrections 2026-10-05 — the Admin Overview (the Admin home, under
 * Command Centre): leads and paid bookings by source, revenue / profit /
 * margin / refunds / expenses (finance.manage only), staff workload, and
 * alerts. Queries run one after another (runSequentially) like the other
 * multi-query Admin screens.
 */

const OPEN_LEAD_STATUSES = ["NEW", "CONTACTED", "FOLLOW_UP_REQUIRED", "CUSTOMER_RESPONDED", "QUALIFIED", "QUOTATION_CREATED", "QUOTATION_ACCEPTED", "PAYMENT_PENDING"] as const;
const PAID_BOOKING_STATUSES = ["CONFIRMED", "PROCESSING", "COMPLETED"] as const;

export interface SourceCount {
  source: string;
  count: number;
}

export interface AdminOverview {
  from: string;
  to: string;
  leads: { total: number; bySource: SourceCount[]; byService: { serviceType: ServiceType; count: number }[] };
  bookings: { total: number; bySource: SourceCount[] };
  /** null unless the viewer has finance.manage. */
  finance: { sales: number; revenue: number; grossProfit: number; marginPercent: number | null; refunds: number; expenses: number; netProfit: number } | null;
  workload: { staffId: string | null; name: string; openLeads: number }[];
  alerts: { goLiveRedChecks: number; failedPayments: number; ocrFailures: number; failedAutomationRuns: number; openComplaints: number };
}

function groupSources(rows: { source: string | null; _count: { _all: number } }[]): SourceCount[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = row.source?.trim() || "Unknown";
    totals.set(key, (totals.get(key) ?? 0) + row._count._all);
  }
  return [...totals.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count);
}

export async function buildAdminOverview(input: { from: Date; to: Date; includeFinance: boolean }): Promise<AdminOverview> {
  const { from, to } = input;
  const createdInPeriod = { gte: from, lt: to };

  const [leadSources, leadServices, bookingRows, workloadRows, failedPayments, ocrFailures, failedRuns, openComplaints] = await runSequentially([
    () => db.lead.groupBy({ by: ["source"], where: { createdAt: createdInPeriod }, _count: { _all: true } }),
    () => db.lead.groupBy({ by: ["serviceType"], where: { createdAt: createdInPeriod }, _count: { _all: true } }),
    () =>
      db.booking.findMany({
        where: { createdAt: createdInPeriod, status: { in: [...PAID_BOOKING_STATUSES] } },
        select: { lead: { select: { source: true } } },
      }),
    () => db.lead.groupBy({ by: ["assignedStaffId"], where: { status: { in: [...OPEN_LEAD_STATUSES] } }, _count: { _all: true } }),
    () => db.payment.count({ where: { status: { in: ["FAILED", "EXPIRED"] }, updatedAt: createdInPeriod } }),
    () => db.auditTrail.count({ where: { action: "OCR_FAILED", timestamp: createdInPeriod } }),
    () => db.automationRun.count({ where: { status: "FAILURE", createdAt: createdInPeriod } }),
    () => db.enquiry.count({ where: { category: "COMPLAINT", status: { notIn: ["RESOLVED", "CLOSED"] } } }),
  ]);

  const staffIds = workloadRows.map((row) => row.assignedStaffId).filter((id): id is string => id !== null);
  const staff = staffIds.length ? await db.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true } }) : [];
  const staffName = new Map(staff.map((member) => [member.id, member.name]));

  const bookingSourceCounts = new Map<string, number>();
  for (const row of bookingRows) {
    const key = row.lead.source?.trim() || "Unknown";
    bookingSourceCounts.set(key, (bookingSourceCounts.get(key) ?? 0) + 1);
  }

  let finance: AdminOverview["finance"] = null;
  if (input.includeFinance) {
    const report = await buildManagementReport({ from, to });
    const value = (key: string) => report.lines.find((line) => line.key === key)?.value ?? 0;
    const revenue = value("revenue");
    const grossProfit = value("grossProfit");
    finance = {
      sales: value("sales"),
      revenue,
      grossProfit,
      marginPercent: revenue > 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : null,
      refunds: value("refunds"),
      expenses: value("expenses"),
      netProfit: value("netProfit"),
    };
  }

  const goLiveChecks = await getGoLiveChecks();

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    leads: {
      total: leadSources.reduce((sum, row) => sum + row._count._all, 0),
      bySource: groupSources(leadSources),
      byService: leadServices.map((row) => ({ serviceType: row.serviceType, count: row._count._all })).sort((a, b) => b.count - a.count),
    },
    bookings: {
      total: bookingRows.length,
      bySource: [...bookingSourceCounts.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    },
    finance,
    workload: workloadRows
      .map((row) => ({
        staffId: row.assignedStaffId,
        name: row.assignedStaffId ? (staffName.get(row.assignedStaffId) ?? "Unknown") : "Unassigned",
        openLeads: row._count._all,
      }))
      .sort((a, b) => b.openLeads - a.openLeads),
    alerts: {
      goLiveRedChecks: goLiveChecks.filter((check) => !check.ok).length,
      failedPayments,
      ocrFailures,
      failedAutomationRuns: failedRuns,
      openComplaints,
    },
  };
}
