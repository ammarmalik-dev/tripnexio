import type { Metadata } from "next";
import { RefundReport } from "@/components/admin/RefundReport";

export const metadata: Metadata = { title: "Refund Report | Admin" };

export default function AdminRefundReportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Refund Report</h1>
        <p className="text-sm text-ink-tertiary">
          Every refund raised in a selected date range, broken down by status and service, with a CSV export.
          Reporting only — change a refund&apos;s status from the Refunds screen.
        </p>
      </div>
      <RefundReport />
    </div>
  );
}
