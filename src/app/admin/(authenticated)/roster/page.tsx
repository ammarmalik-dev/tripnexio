import type { Metadata } from "next";
import { StaffRosterManager } from "@/components/admin/StaffRosterManager";

export const metadata: Metadata = { title: "Staff Roster | Admin" };

/** P22 item 8 — ADMIN.md §13 Roster & Assignment. The API (GET/PUT /api/admin/roster) enforces staff.manage server-side. */
export default function AdminRosterPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Staff Roster</h1>
        <p className="text-sm text-ink-tertiary">
          Set which services each staff member covers on each weekday. With auto-assign on, a new lead goes to the
          rostered, available staff member with the lowest PAX workload (fewest open leads breaks a tie). Staff on
          approved leave are skipped automatically — manage leave under Staff Leave.
        </p>
      </div>
      <StaffRosterManager />
    </div>
  );
}
