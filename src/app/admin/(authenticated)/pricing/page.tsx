import type { Metadata } from "next";
import { PricingRulesManager } from "@/components/admin/PricingRulesManager";

export const metadata: Metadata = { title: "Pricing | Admin" };

export default function AdminPricingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Pricing Configuration</h1>
        <p className="text-sm text-ink-tertiary">
          Base price and additional charges per service and passenger type, optionally overridden per nationality.
          This is staff reference pricing — the quote builder still takes staff-entered figures per quotation. A few
          clearly-labeled SAMPLE rows are seeded for development — propose the real pricing for review before it
          replaces them.
        </p>
      </div>
      <PricingRulesManager />
    </div>
  );
}
