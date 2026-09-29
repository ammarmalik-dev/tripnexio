import type { Metadata } from "next";
import { SpecialFareAnalyticsView } from "@/components/crm/SpecialFareAnalyticsView";

export const metadata: Metadata = { title: "Special Fare Analytics | Internal Dashboard" };

export default function SpecialFareAnalyticsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Special Fare Analytics</h1>
        <p className="text-sm text-ink-tertiary">Enquiries, quotes, conversion and refunds for Flight Special Fare requests created in the selected period.</p>
      </div>
      <SpecialFareAnalyticsView />
    </div>
  );
}
