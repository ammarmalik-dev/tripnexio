import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/staff-session";
import { canAccessAdminSection } from "@/lib/auth/permissions";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { CrmTopbar } from "@/components/crm/CrmTopbar";
import { StaffPermissionsProvider } from "@/components/crm/StaffPermissions";

export default async function CrmAuthenticatedLayout({ children }: { children: ReactNode }) {
  const session = await getStaffSession();
  if (!session) {
    redirect("/crm/login");
  }

  return (
    <StaffPermissionsProvider permissions={session.permissions} servicePermissions={session.servicePermissions} refundApprovalLimit={session.refundApprovalLimit}>
    {/* Client doc 16 Nov (K1) — the shell is the screen height: logo + sidebar and the top bar stay put, only main scrolls. */}
    <div className="crm-shell flex h-dvh overflow-hidden">
      <CrmSidebar showAdminLink={canAccessAdminSection(session)} permissions={session.permissions} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CrmTopbar staffName={session.name} staffRole={session.role} />
        <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4">{children}</main>
      </div>
    </div>
    </StaffPermissionsProvider>
  );
}
