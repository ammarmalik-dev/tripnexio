import type { Metadata } from "next";
import { ProtectionPlanConfigManager } from "@/components/admin/ProtectionPlanConfigManager";
import { ProtectionPlanCountriesManager } from "@/components/admin/ProtectionPlanCountriesManager";

export const metadata: Metadata = { title: "Protection Plan | Admin" };

export default function AdminProtectionPlanPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Protection Plan</h1>
        <p className="text-sm text-ink-tertiary">
          New Visa&apos;s per-passenger add-on (New_Visa.md §8-9). Enable it per destination country; customers choose it per traveller
          on the application summary, and it is charged as its own &quot;Protection Plan&quot; line.
        </p>
      </div>
      <ProtectionPlanCountriesManager />
      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-heading">Defaults</h2>
        <ProtectionPlanConfigManager />
      </div>
    </div>
  );
}
