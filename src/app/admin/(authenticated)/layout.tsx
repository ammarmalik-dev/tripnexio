import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { CrmTopbar } from "@/components/crm/CrmTopbar";

/**
 * Authoritative Admin gate — the fast Edge check in src/proxy.ts only
 * confirms a valid staff session exists, not that it's allowed into Admin.
 * A signed-in staff member without roles.manage/staff.manage/
 * masters.manage/admin.full is redirected straight back to the CRM, the
 * same way a signed-out visitor is redirected to /crm/login — this page
 * never even starts rendering for them, so there's nothing for a
 * limited-role user to see here regardless of what the sidebar link
 * visibility does.
 */
export default async function AdminAuthenticatedLayout({ children }: { children: ReactNode }) {
  const session = await getStaffSession();
  if (!session) {
    redirect("/crm/login?from=/admin");
  }

  const canAccessAdmin =
    hasPermission(session, "roles.manage") || hasPermission(session, "staff.manage") || hasPermission(session, "masters.manage");
  if (!canAccessAdmin) {
    redirect("/crm/leads");
  }

  return (
    <div className="flex min-h-screen bg-surface-2">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <CrmTopbar staffName={session.name} staffRole={session.role} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
