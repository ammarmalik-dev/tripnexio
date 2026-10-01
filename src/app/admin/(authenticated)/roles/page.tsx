import type { Metadata } from "next";
import { RolesManager } from "@/components/admin/RolesManager";

export const metadata: Metadata = { title: "Roles & Permissions | Admin" };

export default function AdminRolesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Roles &amp; Permissions</h1>
        <p className="text-sm text-ink-tertiary">
          Pick a role on the left, then switch permissions on or off by category. Changes apply to everyone with that role on their next
          action, and every CRM/Admin screen enforces them on the server.
        </p>
      </div>
      <RolesManager />
    </div>
  );
}
