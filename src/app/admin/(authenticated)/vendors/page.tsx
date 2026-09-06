import type { Metadata } from "next";
import { VendorsManager } from "@/components/admin/VendorsManager";

export const metadata: Metadata = { title: "Vendors | Admin" };

export default function AdminVendorsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Vendors</h1>
        <p className="text-sm text-ink-tertiary">
          Manage the vendor list used in the CRM quote builder. A few clearly-labeled SAMPLE vendors are seeded for
          development — propose the real list for review before it replaces them.
        </p>
      </div>
      <VendorsManager />
    </div>
  );
}
