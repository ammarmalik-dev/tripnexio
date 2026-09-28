import type { Metadata } from "next";
import { RevenueReport } from "@/components/admin/RevenueReport";

export const metadata: Metadata = { title: "Revenue Report | Admin" };

export default function AdminRevenueReportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Revenue Report</h1>
        <p className="text-sm text-ink-tertiary">
          Gross and net revenue for a selected date range, with a service-wise breakdown. Reporting only — see P&amp;L
          Report for profit/margin figures.
        </p>
      </div>
      <RevenueReport />
    </div>
  );
}
