import type { Metadata } from "next";
import { ServiceStatusesManager } from "@/components/admin/ServiceStatusesManager";

export const metadata: Metadata = { title: "Service Statuses | Admin" };

export default function AdminServiceStatusesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Service Statuses</h1>
        <p className="text-sm text-ink-tertiary">
          Each service&apos;s own operational status list and transition rules (CRM.md §14). Seeded from each
          service&apos;s locked spec document — edit, reorder, or add new statuses and transitions here. This
          configures the catalog only; the Lead/Booking detail screens don&apos;t read from it yet (a later roadmap
          unit wires the actual staff-facing Change Status control to this list).
        </p>
      </div>
      <ServiceStatusesManager />
    </div>
  );
}
