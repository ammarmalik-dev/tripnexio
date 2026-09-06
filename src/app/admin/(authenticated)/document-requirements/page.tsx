import type { Metadata } from "next";
import { DocumentRequirementsManager } from "@/components/admin/DocumentRequirementsManager";

export const metadata: Metadata = { title: "Document Requirements | Admin" };

export default function AdminDocumentRequirementsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Document Requirements</h1>
        <p className="text-sm text-ink-tertiary">
          Required and optional documents per nationality per service — this drives the customer document checklist.
          A few clearly-labeled SAMPLE rows are seeded for development — propose the real list for review before it replaces them.
        </p>
      </div>
      <DocumentRequirementsManager />
    </div>
  );
}
