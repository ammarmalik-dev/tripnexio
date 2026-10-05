import type { Metadata } from "next";
import { Suspense } from "react";
import { LeadsTable } from "@/components/crm/LeadsTable";

export const metadata: Metadata = { title: "Follow-ups | Internal Dashboard" };

/** Client corrections 2026-10-05 — Operations → Follow-ups: leads marked "Follow-up Required". */
export default function CrmFollowUpsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Follow-ups</h1>
        <p className="text-sm text-ink-tertiary">Leads waiting for a follow-up call or message.</p>
      </div>
      <Suspense>
        <LeadsTable defaultStatus="FOLLOW_UP_REQUIRED" />
      </Suspense>
    </div>
  );
}
