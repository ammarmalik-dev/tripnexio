import type { Metadata } from "next";
import { StaffUsersManager } from "@/components/admin/StaffUsersManager";

export const metadata: Metadata = { title: "Staff | Admin" };

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Staff</h1>
        <p className="text-sm text-ink-tertiary">Create and manage staff accounts, and assign their roles.</p>
      </div>
      <StaffUsersManager />
    </div>
  );
}
