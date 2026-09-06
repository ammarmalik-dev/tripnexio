import type { Metadata } from "next";
import { DocumentReviewQueue } from "@/components/crm/DocumentReviewQueue";

export const metadata: Metadata = { title: "Documents | CRM" };

export default function CrmDocumentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Document Verification</h1>
        <p className="text-sm text-ink-tertiary">Review uploaded documents and set their status across every booking.</p>
      </div>
      <DocumentReviewQueue />
    </div>
  );
}
