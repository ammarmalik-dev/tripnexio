import type { Metadata } from "next";
import { RolesManager } from "@/components/admin/RolesManager";

export const metadata: Metadata = { title: "Roles & Permissions | Admin" };

export default function AdminRolesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Roles &amp; Permissions</h1>
        <p className="text-sm text-ink-tertiary">
          Create roles and assign granular permissions. Every CRM/Admin route enforces these server-side.
        </p>
      </div>
      <RolesManager />
    </div>
  );
}
