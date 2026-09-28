import type { Metadata } from "next";
import { ServiceTermsManager } from "@/components/admin/ServiceTermsManager";

export const metadata: Metadata = { title: "Service Terms | Admin" };

export default function AdminServiceTermsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Service Terms</h1>
        <p className="text-sm text-ink-tertiary">
          The Terms &amp; Conditions a customer must agree to before paying or approving a quote. The newest active
          version for the destination country applies, otherwise the newest one for all countries. Versions are never
          edited — publish a new one; every booking keeps the version the customer agreed to. With no terms published,
          customers agree to the general website Terms.
        </p>
      </div>
      <ServiceTermsManager />
    </div>
  );
}
