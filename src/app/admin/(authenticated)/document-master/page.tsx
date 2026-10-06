import type { Metadata } from "next";
import { DocumentMasterManager } from "@/components/admin/DocumentMasterManager";

export const metadata: Metadata = { title: "Document Master | Admin" };

export default function AdminDocumentMasterPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Document Master</h1>
        <p className="text-sm text-ink-tertiary">Every document definition in one place. Countries and services pick from this list in Document Requirements.</p>
      </div>
      <DocumentMasterManager />
    </div>
  );
}
