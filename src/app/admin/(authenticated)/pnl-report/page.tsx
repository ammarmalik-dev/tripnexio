import type { Metadata } from "next";
import { PnlReport } from "@/components/admin/PnlReport";

export const metadata: Metadata = { title: "P&L Report | Admin" };

export default function AdminPnlReportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">P&amp;L Report</h1>
        <p className="text-sm text-ink-tertiary">
          Revenue, vendor cost, margin, and expenses for a selected date range. Reporting only — see Expenses to
          record new operating costs.
        </p>
      </div>
      <PnlReport />
    </div>
  );
}
