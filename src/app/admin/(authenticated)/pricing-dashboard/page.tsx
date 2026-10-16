import type { Metadata } from "next";
import { PricingDashboardViews } from "@/components/admin/PricingDashboardViews";
import { parsePricingDashboardView } from "@/lib/admin/pricing-dashboard-views";

export const metadata: Metadata = { title: "Pricing Dashboard | Admin" };

export default async function AdminPricingDashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Pricing Dashboard</h1>
        <p className="text-sm text-ink-tertiary">
          Every configured price by country — open a price to Edit → Save it (a reason is required and every change is
          audited; existing bookings keep their booked price). The table view filters by service, validity and expiry.
          Vendor cost and margin are internal and shown here for Admin only.
        </p>
      </div>
      <PricingDashboardViews initialView={parsePricingDashboardView(view)} />
    </div>
  );
}
