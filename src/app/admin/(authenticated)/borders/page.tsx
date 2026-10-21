import type { Metadata } from "next";
import { BordersManager } from "@/components/admin/BordersManager";
import { CsvImportPanel } from "@/components/admin/CsvImportPanel";

export const metadata: Metadata = { title: "Borders | Admin" };

export default function AdminBordersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Borders</h1>
        <p className="text-sm text-ink-tertiary">
          Manage border crossing points used for Visa Change (Border Exit).
        </p>
      </div>
      <CsvImportPanel entity="borders" />
      <BordersManager />
    </div>
  );
}
