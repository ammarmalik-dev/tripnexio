import type { Metadata } from "next";
import { StaffLeaveManager } from "@/components/admin/StaffLeaveManager";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Staff Leave | Admin" };

export default async function AdminStaffLeavePage() {
  const session = await getStaffSession();
  const canApprove = hasPermission(session, "staff.leave.approve");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Staff Leave</h1>
        <p className="text-sm text-ink-tertiary">
          Staff can request their own leave from the CRM — it stays Pending until approved or rejected here. Once
          Approved, a staff member is excluded from auto-assignment suggestions for the duration. Record one directly
          for any staff member below to create it Approved right away. To move already-assigned open work elsewhere,
          use Bulk Reassignment.
        </p>
      </div>
      <StaffLeaveManager canApprove={canApprove} />
    </div>
  );
}
