import type { Metadata } from "next";
import { SalesTracker } from "@/components/admin/SalesTracker";

export const metadata: Metadata = { title: "Sales Tracker | Admin" };

/** Client doc 16 Nov (J9) — the API (GET / PUT /api/admin/sales-tracker) enforces staff.manage server-side. */
export default function AdminSalesTrackerPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Sales Tracker</h1>
        <p className="text-sm text-ink-tertiary">
          Each POC&apos;s sales performance and the team total — assigned and received leads, converted leads, successful payments, revenue,
          conversion rate and target vs. achievement. Set monthly targets per POC below.
        </p>
      </div>
      <SalesTracker />
    </div>
  );
}
