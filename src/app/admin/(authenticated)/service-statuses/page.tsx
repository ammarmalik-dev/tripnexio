import type { Metadata } from "next";
import { ServiceStatusesManager } from "@/components/admin/ServiceStatusesManager";

export const metadata: Metadata = { title: "Service Statuses | Admin" };

export default function AdminServiceStatusesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Service Statuses</h1>
        <p className="text-sm text-ink-tertiary">
          Each service&apos;s own Lead and Booking status lists and transition rules (CRM.md §14). The CRM Change
          Status control offers only the transitions configured here. The customer-safe label is what /account,
          Track Status and customer messages show. &ldquo;Moved here automatically on&rdquo; links a status to a
          system event (payment, quotation, documents), and &ldquo;Notify customer with&rdquo; sends a message when a
          record enters it. &ldquo;Blocks refund&rdquo; drives the refund rules.
        </p>
      </div>
      <ServiceStatusesManager />
    </div>
  );
}
