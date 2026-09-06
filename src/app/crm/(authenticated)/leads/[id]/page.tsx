import type { Metadata } from "next";
import { LeadDetail } from "@/components/crm/LeadDetail";

export const metadata: Metadata = { title: "Lead Detail | CRM" };

interface LeadDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CrmLeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params;
  return <LeadDetail leadId={id} />;
}
