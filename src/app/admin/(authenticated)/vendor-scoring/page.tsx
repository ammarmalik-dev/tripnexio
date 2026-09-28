import type { Metadata } from "next";
import { VendorScoringConfigManager } from "@/components/admin/VendorScoringConfigManager";

export const metadata: Metadata = { title: "Vendor Scoring | Admin" };

export default function AdminVendorScoringPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Vendor Scoring</h1>
        <p className="text-sm text-ink-tertiary">
          Business Rules §8 &quot;Vendor Selection&quot; — configure how much each factor counts toward a vendor&apos;s
          overall recommendation score shown to staff in the quote builder.
        </p>
      </div>
      <VendorScoringConfigManager />
    </div>
  );
}
