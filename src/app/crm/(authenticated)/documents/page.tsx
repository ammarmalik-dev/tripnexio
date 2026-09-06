import type { Metadata } from "next";
import { CrmComingSoon } from "@/components/crm/CrmComingSoon";

export const metadata: Metadata = { title: "Documents | CRM" };

export default function CrmDocumentsPage() {
  return <CrmComingSoon title="Documents" />;
}
