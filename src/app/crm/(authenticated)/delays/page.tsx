import type { Metadata } from "next";
import { DelayAnalysisView } from "@/components/crm/DelayAnalysisView";

export const metadata: Metadata = { title: "Delay Analysis | Internal Dashboard" };

export default function CrmDelaysPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Delay Analysis</h1>
        <p className="text-sm text-ink-tertiary">
          Bookings past their Admin-configured SLA — completion time, or document verification time. Live snapshot, not period-filtered.
        </p>
      </div>
      <DelayAnalysisView />
    </div>
  );
}
