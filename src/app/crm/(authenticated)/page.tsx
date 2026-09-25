import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";
import { CommandCentre } from "@/components/crm/CommandCentre";

export const metadata: Metadata = { title: "Command Centre | Internal Dashboard" };

export default async function CrmIndexPage() {
  const session = await getStaffSession();
  if (!session) {
    redirect("/crm/login");
  }

  return (
    <Suspense>
      <CommandCentre staffName={session.name} canManageMasters={hasPermission(session, "masters.manage")} />
    </Suspense>
  );
}
