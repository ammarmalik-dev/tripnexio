import type { Metadata } from "next";
import { StaffLeaveManager } from "@/components/admin/StaffLeaveManager";

export const metadata: Metadata = { title: "Staff Leave | Admin" };

export default function AdminStaffLeavePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Staff Leave</h1>
        <p className="text-sm text-ink-tertiary">
          Record when a staff member is unavailable — they&apos;re excluded from auto-assignment suggestions for the
          duration. To move their already-assigned open work elsewhere, use Bulk Reassignment.
        </p>
      </div>
      <StaffLeaveManager />
    </div>
  );
}
