import type { Metadata } from "next";
import { EnquiryDetail } from "@/components/crm/enquiries/EnquiryDetail";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Enquiry | Internal Dashboard" };

interface EnquiryPageProps {
  params: Promise<{ id: string }>;
}

export default async function CrmEnquiryPage({ params }: EnquiryPageProps) {
  const { id } = await params;
  const session = await getStaffSession();
  // UI courtesy only — every enquiry API checks leads.edit itself.
  return <EnquiryDetail enquiryId={id} canEdit={hasPermission(session, "leads.edit")} />;
}