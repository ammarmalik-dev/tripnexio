import type { Metadata } from "next";
import { LeadsTable } from "@/components/crm/LeadsTable";

export const metadata: Metadata = { title: "Leads | Internal Dashboard" };

export default function CrmLeadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Leads</h1>
        <p className="text-sm text-ink-tertiary">Every service request submitted through the website.</p>
      </div>
      <LeadsTable />
    </div>
  );
}
