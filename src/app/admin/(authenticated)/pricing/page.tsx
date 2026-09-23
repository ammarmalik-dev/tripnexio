import type { Metadata } from "next";
import { PricingRulesManager } from "@/components/admin/PricingRulesManager";

export const metadata: Metadata = { title: "Pricing | Admin" };

export default function AdminPricingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Pricing Configuration</h1>
        <p className="text-sm text-ink-tertiary">
          The central pricing control for every auto-priced service — country, processing type, passenger type,
          vendor cost, selling price, extra charges and validity dates. New Visa&apos;s website checkout reads real
          rates from here. Editing a rule never changes an already-quoted or paid booking&apos;s price. OTB (priced
          per airline, at Admin → Airlines) and Return Ticket (a flat per-country rate, at Admin → Return Ticket
          Destinations) aren&apos;t covered here — their rate shapes don&apos;t fit this table cleanly; flagged for
          review rather than forced in. A few clearly-labeled SAMPLE rows are seeded for development — propose the
          real pricing for review before it replaces them.
        </p>
      </div>
      <PricingRulesManager />
    </div>
  );
}
