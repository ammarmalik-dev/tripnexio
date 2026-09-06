import type { Metadata } from "next";
import { BordersManager } from "@/components/admin/BordersManager";

export const metadata: Metadata = { title: "Borders | Admin" };

export default function AdminBordersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Borders</h1>
        <p className="text-sm text-ink-tertiary">
          Manage border crossing points used for Visa Change (Border Exit). A clearly-labeled SAMPLE row is seeded
          for development — propose the real list for review before it replaces it.
        </p>
      </div>
      <BordersManager />
    </div>
  );
}
