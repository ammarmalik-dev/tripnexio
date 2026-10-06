import type { Metadata } from "next";
import { EnquiryDetail } from "@/components/crm/enquiries/EnquiryDetail";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Enquiry | Admin" };

interface AdminEnquiryPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEnquiryPage({ params }: AdminEnquiryPageProps) {
  const { id } = await params;
  const session = await getStaffSession();
  // UI courtesy only — every enquiry API checks leads.edit itself; actions are audited there.
  return <EnquiryDetail enquiryId={id} canEdit={hasPermission(session, "leads.edit")} basePath="/admin/enquiries" />;
}
