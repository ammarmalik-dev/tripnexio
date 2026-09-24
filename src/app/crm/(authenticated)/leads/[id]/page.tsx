import type { Metadata } from "next";
import { LeadDetail } from "@/components/crm/LeadDetail";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Lead Detail | Internal Dashboard" };

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CrmLeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  const session = await getStaffSession();
  const canReassignLeads = hasPermission(session, "leads.reassign");
  return <LeadDetail leadId={id} canReassignLeads={canReassignLeads} />;
}
