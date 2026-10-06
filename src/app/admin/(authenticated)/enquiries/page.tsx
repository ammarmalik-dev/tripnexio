import type { Metadata } from "next";
import { Suspense } from "react";
import { EnquiriesTable } from "@/components/crm/enquiries/EnquiriesTable";

export const metadata: Metadata = { title: "Enquiries & Escalation | Admin" };

/** Client corrections 2026-10-05 — Enquiries & Escalation in Admin (same records and APIs as the CRM screen). */
export default function AdminEnquiriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Enquiries &amp; Escalation</h1>
        <p className="text-sm text-ink-tertiary">Website enquiries and complaints. Complaints are escalated to managers and need a resolution note to close.</p>
      </div>
      <Suspense>
        <EnquiriesTable basePath="/admin/enquiries" />
      </Suspense>
    </div>
  );
}
