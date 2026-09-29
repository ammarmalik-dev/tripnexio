import type { Metadata } from "next";
import { CrmReportsView } from "@/components/crm/CrmReportsView";

export const metadata: Metadata = { title: "Reports | Internal Dashboard" };

export default function CrmReportsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Reports</h1>
        <p className="text-sm text-ink-tertiary">Leads, bookings, conversion, revenue, refunds, service mix and staff workload for the selected period.</p>
      </div>
      <CrmReportsView />
    </div>
  );
}
