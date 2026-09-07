import type { Metadata } from "next";
import { TaxFeeConfigManager } from "@/components/admin/TaxFeeConfigManager";

export const metadata: Metadata = { title: "Tax & Fees | Admin" };

export default function AdminTaxFeePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Tax &amp; Fee Configuration</h1>
        <p className="text-sm text-ink-tertiary">
          GST/tax rate and gateway fee percentage, used directly in every new payment&apos;s calculation. This
          replaces the previously hard-coded sample rates in code.
        </p>
      </div>
      <TaxFeeConfigManager />
    </div>
  );
}
