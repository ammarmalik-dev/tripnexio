import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/staff-session";
import { CrmSidebar } from "@/components/crm/CrmSidebar";
import { CrmTopbar } from "@/components/crm/CrmTopbar";

export default async function CrmAuthenticatedLayout({ children }: { children: ReactNode }) {
  const session = await getStaffSession();
  if (!session) {
    redirect("/crm/login");
  }

  return (
    <div className="flex min-h-screen bg-surface-2">
      <CrmSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <CrmTopbar staffName={session.name} staffRole={session.role} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
