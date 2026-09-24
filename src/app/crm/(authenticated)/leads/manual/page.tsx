import type { Metadata } from "next";
import { ManualLeadForm } from "@/components/crm/ManualLeadForm";

export const metadata: Metadata = { title: "Manual Lead | Internal Dashboard" };

export default function CrmManualLeadPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Manual Lead</h1>
        <p className="text-sm text-ink-tertiary">
          Record a request a customer made offline (phone or walk-in). Fixed-rate services auto-calculate a price; others route to Quotations.
        </p>
      </div>
      <ManualLeadForm />
    </div>
  );
}
