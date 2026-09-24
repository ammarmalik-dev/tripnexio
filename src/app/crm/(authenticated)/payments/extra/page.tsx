import type { Metadata } from "next";
import { ExtraPaymentsPageContent } from "@/components/crm/ExtraPaymentsPageContent";

export const metadata: Metadata = { title: "Extra Payments | Internal Dashboard" };

export default function CrmExtraPaymentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Extra Payment Collection</h1>
        <p className="text-sm text-ink-tertiary">
          Search an existing booking to collect an additional charge, and track every extra payment ever raised.
        </p>
      </div>
      <ExtraPaymentsPageContent />
    </div>
  );
}
