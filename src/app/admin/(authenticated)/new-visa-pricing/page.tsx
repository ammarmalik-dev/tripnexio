import type { Metadata } from "next";
import { NewVisaPricingManager } from "@/components/admin/NewVisaPricingManager";

export const metadata: Metadata = { title: "New Visa Pricing | Admin" };

export default function AdminNewVisaPricingPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">New Visa Pricing</h1>
        <p className="text-sm text-ink-tertiary">
          The rate New Visa customers pay right after the form — one row per country + Normal/Express, with separate
          Adult/Child/Infant prices. A destination with no rate configured here can&apos;t be auto-charged; staff will
          need to follow up manually until a rate is added.
        </p>
      </div>
      <NewVisaPricingManager />
    </div>
  );
}
