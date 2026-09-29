import type { Metadata } from "next";
import { PricingDashboard } from "@/components/admin/PricingDashboard";

export const metadata: Metadata = { title: "Pricing Dashboard | Admin" };

export default function AdminPricingDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Pricing Dashboard</h1>
        <p className="text-sm text-ink-tertiary">
          Every pricing rule at a glance — filter by country, service, sub-service, visa type and processing type, see
          which rates are in effect on a given date and which are about to expire. Vendor cost and margin are internal
          and shown here for Admin only. Edit a rule under Admin → Pricing.
        </p>
      </div>
      <PricingDashboard />
    </div>
  );
}
