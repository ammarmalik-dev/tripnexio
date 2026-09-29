import type { Metadata } from "next";
import { CrmVendorsView } from "@/components/crm/CrmVendorsView";

export const metadata: Metadata = { title: "Vendors | Internal Dashboard" };

export default function CrmVendorsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Vendors</h1>
        <p className="text-sm text-ink-tertiary">
          Active vendors, the services they handle, processing and availability, and their recommendation score. Read-only — vendor setup and rates are managed by Admin.
        </p>
      </div>
      <CrmVendorsView />
    </div>
  );
}
