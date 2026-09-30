import type { Metadata } from "next";
import { ConfigHistoryViewer } from "@/components/admin/ConfigHistoryViewer";

export const metadata: Metadata = { title: "Configuration History | Admin" };

export default function AdminConfigHistoryPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Configuration History</h1>
        <p className="text-sm text-ink-tertiary">
          Every change to Admin-managed configuration — settings, pricing, statuses, masters, vendors, templates, and roles — including
          pricing-rule and vendor-rate old → new values, newest first.
        </p>
      </div>
      <ConfigHistoryViewer />
    </div>
  );
}
