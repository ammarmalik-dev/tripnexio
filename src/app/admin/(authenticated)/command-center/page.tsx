import type { Metadata } from "next";
import { AdminCommandCenter } from "@/components/admin/AdminCommandCenter";

export const metadata: Metadata = { title: "AI Command Center | Admin" };

export default function AdminCommandCenterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">AI Command Center</h1>
        <p className="text-sm text-ink-tertiary">
          Ask a question in plain language — bookings, refunds, staff workload, integration health, pricing changes.
          Read-only for now: it can look things up, but can&apos;t create, change, or disable anything yet.
        </p>
      </div>
      <AdminCommandCenter />
    </div>
  );
}
