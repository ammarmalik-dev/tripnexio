import type { Metadata } from "next";
import { Suspense } from "react";
import { EnquiriesTable } from "@/components/crm/enquiries/EnquiriesTable";

export const metadata: Metadata = { title: "Enquiries | Internal Dashboard" };

export default function CrmEnquiriesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Enquiries &amp; Complaints</h1>
        <p className="text-sm text-ink-tertiary">
          Messages from the website&apos;s Contact page. Convert a genuine business enquiry to a lead; complaints are escalated to managers.
        </p>
      </div>
      <Suspense>
        <EnquiriesTable />
      </Suspense>
    </div>
  );
}