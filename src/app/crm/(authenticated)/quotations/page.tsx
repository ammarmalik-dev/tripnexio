import type { Metadata } from "next";
import { QuotationsTable } from "@/components/crm/QuotationsTable";

export const metadata: Metadata = { title: "Quotations | Internal Dashboard" };

export default function CrmQuotationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Quotations</h1>
        <p className="text-sm text-ink-tertiary">Every quote built across all leads.</p>
      </div>
      <QuotationsTable />
    </div>
  );
}
