import type { Metadata } from "next";
import { ProtectionPlanConfigManager } from "@/components/admin/ProtectionPlanConfigManager";

export const metadata: Metadata = { title: "Protection Plan | Admin" };

export default function AdminProtectionPlanPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Protection Plan</h1>
        <p className="text-sm text-ink-tertiary">
          New Visa&apos;s per-passenger add-on (New_Visa.md §8-9). Configure the default price, terms, and eligibility
          conditions here — offered automatically to every passenger on a New Visa booking.
        </p>
      </div>
      <ProtectionPlanConfigManager />
    </div>
  );
}
