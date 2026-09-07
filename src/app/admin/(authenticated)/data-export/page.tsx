import type { Metadata } from "next";
import { DataExportPanel } from "@/components/admin/DataExportPanel";

export const metadata: Metadata = { title: "Data Export | Admin" };

export default function AdminDataExportPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Data Export</h1>
        <p className="text-sm text-ink-tertiary">Export core tables to CSV for offline analysis or backup.</p>
      </div>
      <DataExportPanel />
    </div>
  );
}
