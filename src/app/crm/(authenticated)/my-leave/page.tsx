import type { Metadata } from "next";
import { MyLeavePanel } from "@/components/crm/MyLeavePanel";

export const metadata: Metadata = { title: "My Leave | Internal Dashboard" };

export default function CrmMyLeavePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">My Leave</h1>
        <p className="text-sm text-ink-tertiary">
          Request time off — it stays Pending until an Admin approves or rejects it. Only Approved leave excludes you
          from auto-assignment suggestions for the duration.
        </p>
      </div>
      <MyLeavePanel />
    </div>
  );
}
