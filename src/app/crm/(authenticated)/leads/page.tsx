import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { LeadsTable } from "@/components/crm/LeadsTable";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = { title: "Leads | Internal Dashboard" };

export default function CrmLeadsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-heading">Leads</h1>
          <p className="text-sm text-ink-tertiary">Every service request submitted through the website.</p>
        </div>
        <ButtonLink href="/crm/leads/manual" size="sm">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Manual Lead
        </ButtonLink>
      </div>
      <Suspense>
        <LeadsTable />
      </Suspense>
    </div>
  );
}
