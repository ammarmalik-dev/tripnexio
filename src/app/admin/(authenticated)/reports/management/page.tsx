import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSystemConfig } from "@/lib/settings/system-config";
import { ManagementDashboard } from "@/components/admin/reports/ManagementDashboard";

export const metadata: Metadata = { title: "Management Dashboard | Admin" };

/** P25 (Locked Business Rules v2.0 §15) — Sales to Net Profit waterfall, GST liability, net cash movement. */
export default async function AdminManagementDashboardPage() {
  const { currencyCode } = await getSystemConfig();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/reports" className="inline-flex w-fit items-center gap-1 text-xs text-ink-tertiary hover:text-ink-primary">
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> All reports
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-ink-heading">Management Dashboard</h1>
          <p className="text-sm text-ink-tertiary">
            Sales through to Net Profit for a period, with GST liability and net cash movement, compared with the previous period of
            the same length. Every figure&apos;s definition is listed below the chart.
          </p>
        </div>
      </div>
      <ManagementDashboard currencyCode={currencyCode} />
    </div>
  );
}
