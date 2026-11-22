import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { StaffPermissionsProvider } from "@/components/crm/StaffPermissions";
import { CommunicationsPanel } from "@/components/crm/CommunicationsPanel";

export const metadata: Metadata = { title: "WhatsApp chat | TripNexio" };

/**
 * Client doc 16 Nov (L1) — one customer's chat in its own small window (WhatsApp Chats → Pop out), so staff keep
 * replying while they work on other CRM screens. Same access as the lead's Communications tab.
 */
export default async function ChatWindowPage({ params }: { params: Promise<{ leadId: string }> }) {
  const session = await getStaffSession();
  if (!session) redirect("/crm/login");
  if (!hasPermission(session, "leads.view")) notFound();
  const { leadId } = await params;
  const lead = await db.lead.findUnique({ where: { id: leadId }, select: { id: true, reference: true, customer: { select: { name: true } } } });
  if (!lead) notFound();
  return (
    <StaffPermissionsProvider permissions={session.permissions} servicePermissions={session.servicePermissions} refundApprovalLimit={session.refundApprovalLimit}>
      <main className="crm-shell flex min-h-dvh flex-col gap-3 bg-surface-0 p-4">
        <h1 className="text-sm font-semibold text-ink-heading">
          {lead.customer.name} · {lead.reference ?? "new request"}
        </h1>
        <CommunicationsPanel leadId={lead.id} />
      </main>
    </StaffPermissionsProvider>
  );
}
