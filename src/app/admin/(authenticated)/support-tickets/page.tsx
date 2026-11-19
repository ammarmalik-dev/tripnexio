import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/staff-session";
import { canManageTickets } from "@/lib/support/ticket-access";
import { SupportTicketsPanel } from "@/components/crm/help/SupportTicketsPanel";

export const metadata: Metadata = { title: "Support Tickets | Admin" };

/** Client doc 16 Nov (L3) — every help desk ticket: assign, status (Open / In Progress / Resolved), comments, history. */
export default async function AdminSupportTicketsPage({ searchParams }: { searchParams: Promise<{ ticket?: string }> }) {
  const session = await getStaffSession();
  if (!canManageTickets(session)) redirect("/admin");
  const { ticket } = await searchParams;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Support Tickets</h1>
        <p className="text-sm text-ink-tertiary">Issues staff raise from the CRM Help page. Assign them, update the status, comment, and resolve with a note.</p>
      </div>
      <SupportTicketsPanel scope="all" initialTicketId={ticket ?? null} />
    </div>
  );
}
