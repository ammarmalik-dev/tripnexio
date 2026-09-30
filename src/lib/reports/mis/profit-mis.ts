import { paymentScopeWhere, round2 } from "../scope";
import type { ReportCell, ReportColumn, ReportDefinition, ReportFilters, ReportResult } from "../types";
import type { ServiceType } from "../../../generated/prisma/enums";
import { ALL_SERVICE_TYPES, bucket, capRows, loadRevenueFacts, loadSelectedQuotations, monthsInRange, percentOf, serviceLabel, totalsFor, type PaymentFact } from "./shared";

interface ProfitAcc {
  revenue: number;
  vendorCost: number;
  refunds: number;
}

const emptyAcc = (): ProfitAcc => ({ revenue: 0, vendorCost: 0, refunds: 0 });

const columns: ReportColumn[] = [
  { key: "month", label: "Month", kind: "text" },
  { key: "service", label: "Service", kind: "text" },
  { key: "revenueExGst", label: "Revenue (ex GST)", kind: "money" },
  { key: "vendorCost", label: "Vendor cost", kind: "money" },
  { key: "grossProfit", label: "Gross profit", kind: "money" },
  { key: "marginPercent", label: "Margin %", kind: "percent" },
  { key: "refunds", label: "Refunds", kind: "money" },
  { key: "netProfit", label: "Net", kind: "money" },
];

function toRow(month: string, service: string, acc: ProfitAcc): Record<string, ReportCell> {
  const gross = acc.revenue - acc.vendorCost;
  return {
    month,
    service,
    revenueExGst: round2(acc.revenue),
    vendorCost: round2(acc.vendorCost),
    grossProfit: round2(gross),
    marginPercent: percentOf(gross, acc.revenue),
    refunds: round2(acc.refunds),
    netProfit: round2(gross - acc.refunds),
  };
}

async function run(filters: ReportFilters): Promise<ReportResult> {
  const paymentScope = await paymentScopeWhere(filters);
  const { payments, refunds } = await loadRevenueFacts(filters.from, filters.to, paymentScope);

  // Vendor cost is booked once per booking, in the month of its earliest PRIMARY success payment in the range.
  const costAnchor = new Map<string, PaymentFact>();
  for (const payment of [...payments].sort((a, b) => a.month.localeCompare(b.month))) {
    if (payment.purpose !== "PRIMARY" || costAnchor.has(payment.bookingId)) continue;
    costAnchor.set(payment.bookingId, payment);
  }
  const selected = await loadSelectedQuotations([...costAnchor.values()].map((payment) => payment.leadId));

  const cells = new Map<string, Map<ServiceType, ProfitAcc>>();
  const cell = (month: string, serviceType: ServiceType) => bucket(bucket(cells, month, () => new Map<ServiceType, ProfitAcc>()), serviceType, emptyAcc);

  for (const payment of payments) cell(payment.month, payment.serviceType).revenue += payment.revenueExGst;
  let missingQuote = 0;
  for (const payment of costAnchor.values()) {
    const quote = selected.get(payment.leadId);
    if (!quote) {
      missingQuote += 1;
      continue;
    }
    cell(payment.month, payment.serviceType).vendorCost += quote.vendorCost;
  }
  for (const refund of refunds) cell(refund.month, refund.serviceType).refunds += refund.amount;

  const rows: Record<string, ReportCell>[] = [];
  for (const month of monthsInRange(filters.from, filters.to)) {
    const perService = cells.get(month);
    if (!perService) continue;
    for (const serviceType of ALL_SERVICE_TYPES) {
      const acc = perService.get(serviceType);
      if (acc) rows.push(toRow(month, serviceLabel(serviceType), acc));
    }
  }

  const totals = totalsFor(columns, rows);
  const totalRevenue = totals.revenueExGst ?? 0;
  const notes = [
    "Revenue (ex GST) = amount minus coupon discount of SUCCESS payments whose updatedAt falls in the range (no succeeded-at column exists); month = that timestamp's calendar month (UTC).",
    "Vendor cost = the lead's selected quotation vendor cost, counted once per booking in the month of that booking's earliest PRIMARY success payment in the range. Extra payments add revenue but no vendor cost.",
    "Gross profit = Revenue - Vendor cost; Margin % = Gross profit / Revenue. Refunds are COMPLETED refunds by their own createdAt month. Net = Gross profit - Refunds. GST and gateway fees are pass-through and not included.",
    `Overall margin: ${percentOf((totals.grossProfit ?? 0), totalRevenue) ?? "n/a"}%.`,
  ];
  if (missingQuote > 0) notes.push(`${missingQuote} paid booking(s) have no selected quotation, so no vendor cost could be attributed to them.`);
  const capped = capRows(rows, notes);
  return { columns, rows: capped, totals, notes };
}

export const profitMisReport: ReportDefinition = {
  key: "profit-mis",
  title: "Profit MIS",
  group: "mis",
  description: "Month-by-service revenue, vendor cost, gross profit, margin %, refunds and net.",
  supportedFilters: ["serviceType", "countryId", "staffId", "vendorId"],
  run,
};
