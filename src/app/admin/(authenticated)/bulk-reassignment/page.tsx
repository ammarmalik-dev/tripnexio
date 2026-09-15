import type { Metadata } from "next";
import { BulkReassignmentManager } from "@/components/admin/BulkReassignmentManager";

export const metadata: Metadata = { title: "Bulk Reassignment | Admin" };

export default function AdminBulkReassignmentPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Bulk Reassignment</h1>
        <p className="text-sm text-ink-tertiary">
          Select a staff member to see their open bookings, then move some or all of that work to someone else in one
          action. A reason is required and every affected lead&apos;s audit trail records it.
        </p>
      </div>
      <BulkReassignmentManager />
    </div>
  );
}
