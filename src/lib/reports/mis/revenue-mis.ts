import { paymentScopeWhere, round2 } from "../scope";
import type { ReportCell, ReportColumn, ReportDefinition, ReportFilters, ReportResult } from "../types";
import type { ServiceType } from "../../../generated/prisma/enums";
import { ALL_SERVICE_TYPES, bucket, capRows, loadRevenueFacts, monthsInRange, percentOf, previousMonthKey, serviceLabel, totalsFor } from "./shared";

interface RevenueAcc {
  revenue: number;
  gst: number;
  gatewayFees: number;
  refunds: number;
}

const emptyAcc = (): RevenueAcc => ({ revenue: 0, gst: 0, gatewayFees: 0, refunds: 0 });

const columns: ReportColumn[] = [
  { key: "month", label: "Month", kind: "text" },
  { key: "service", label: "Service", kind: "text" },
  { key: "revenueExGst", label: "Revenue (ex GST)", kind: "money" },
  { key: "gst", label: "GST", kind: "money" },
  { key: "gatewayFees", label: "Gateway fees", kind: "money" },
  { key: "refunds", label: "Refunds", kind: "money" },
  { key: "netRevenue", label: "Net revenue", kind: "money" },
  { key: "growthPercent", label: "Growth vs prev. month", kind: "percent" },
];

async function run(filters: ReportFilters): Promise<ReportResult> {
  const paymentScope = await paymentScopeWhere(filters);
  const { payments, refunds } = await loadRevenueFacts(filters.from, filters.to, paymentScope);

  // month -> service -> figures
  const cells = new Map<string, Map<ServiceType, RevenueAcc>>();
  const cell = (month: string, serviceType: ServiceType) => bucket(bucket(cells, month, () => new Map<ServiceType, RevenueAcc>()), serviceType, emptyAcc);

  for (const payment of payments) {
    const acc = cell(payment.month, payment.serviceType);
    acc.revenue += payment.revenueExGst;
    acc.gst += payment.gst;
    acc.gatewayFees += payment.gatewayFee;
  }
  for (const refund of refunds) cell(refund.month, refund.serviceType).refunds += refund.amount;

  const months = monthsInRange(filters.from, filters.to);
  const inRange = new Set(months);
  const netOf = (acc: RevenueAcc | undefined) => (acc ? acc.revenue - acc.refunds : 0);

  const rows: Record<string, ReportCell>[] = [];
  for (const month of months) {
    const perService = cells.get(month);
    if (!perService) continue;
    for (const serviceType of ALL_SERVICE_TYPES) {
      const acc = perService.get(serviceType);
      if (!acc) continue;
      const net = netOf(acc);
      const previousKey = previousMonthKey(month);
      const previousNet = inRange.has(previousKey) ? netOf(cells.get(previousKey)?.get(serviceType)) : null;
      rows.push({
        month,
        service: serviceLabel(serviceType),
        revenueExGst: round2(acc.revenue),
        gst: round2(acc.gst),
        gatewayFees: round2(acc.gatewayFees),
        refunds: round2(acc.refunds),
        netRevenue: round2(net),
        growthPercent: previousNet === null || previousNet <= 0 ? null : percentOf(net - previousNet, previousNet),
      });
    }
  }

  const notes = [
    "Revenue, GST and gateway fees come from SUCCESS payments whose updatedAt falls in the range (Payment has no succeeded-at column; same convention as the Revenue and P&L reports). Month = that timestamp's calendar month (UTC).",
    "Revenue (ex GST) = payment amount minus coupon discount (the taxable value, including any Protection Plan); GST and gateway fees are shown separately and not deducted.",
    "Refunds are COMPLETED refunds by their own createdAt month, whatever month the original payment fell in.",
    "Net revenue = Revenue (ex GST) - Refunds. Growth = change in net revenue vs the same service's previous month; blank for the first month of the range or when the previous month's net revenue was zero or negative.",
  ];
  const capped = capRows(rows, notes);
  return { columns, rows: capped, totals: totalsFor(columns, rows), notes };
}

export const revenueMisReport: ReportDefinition = {
  key: "revenue-mis",
  title: "Revenue MIS",
  group: "mis",
  description: "Month-by-service revenue (ex GST), GST, gateway fees, refunds, net revenue and month-on-month growth.",
  supportedFilters: ["serviceType", "countryId", "staffId", "vendorId"],
  run,
};
