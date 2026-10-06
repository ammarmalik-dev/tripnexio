import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { getStaffSession } from "@/lib/auth/staff-session";

export const metadata: Metadata = { title: "Overview | Admin" };

/** Client corrections 2026-10-05 — the Admin home (Command Centre → Overview). */
export default async function AdminOverviewPage() {
  const session = await getStaffSession();
  if (!session) redirect("/crm/login?from=/admin");
  return <AdminOverview staffName={session.name} />;
}
