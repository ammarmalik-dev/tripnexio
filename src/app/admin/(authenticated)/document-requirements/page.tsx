import type { Metadata } from "next";
import { DocumentRequirementsManager } from "@/components/admin/DocumentRequirementsManager";

export const metadata: Metadata = { title: "Document Requirements | Admin" };

export default function AdminDocumentRequirementsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Document Requirements</h1>
        <p className="text-sm text-ink-tertiary">
          The central document checklist control for every service — service, destination country, applicant
          nationality, and passenger type (adult/child/infant) each narrow a rule independently; leave any of them
          unset to apply universally on that dimension. Use Bulk Apply to copy a whole checklist onto other services
          in one action. New Visa&apos;s country setup will reference this same control. A few clearly-labeled
          SAMPLE rows are seeded for development — propose the real list for review before it replaces them.
        </p>
      </div>
      <DocumentRequirementsManager />
    </div>
  );
}
