import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/staff-session";
import { adminNavGroups, filterNavGroups } from "@/lib/crm/nav-config";

/** P21 — land on the first Admin screen this user can actually open (the layout already enforces section access). */
export default async function AdminIndexPage() {
  const session = await getStaffSession();
  const first = session ? filterNavGroups(adminNavGroups, session.permissions)[0]?.items[0]?.href : undefined;
  redirect(first ?? "/crm/leads");
}
