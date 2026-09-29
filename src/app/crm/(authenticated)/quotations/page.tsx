import type { Metadata } from "next";
import { Suspense } from "react";
import { QuotationsWorkspace } from "@/components/crm/QuotationsWorkspace";

export const metadata: Metadata = { title: "Quotations | Internal Dashboard" };

export default function CrmQuotationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Quotations</h1>
        <p className="text-sm text-ink-tertiary">
          Requests awaiting a quote, and every quote built across all leads.
        </p>
      </div>
      <Suspense>
        <QuotationsWorkspace />
      </Suspense>
    </div>
  );
}
