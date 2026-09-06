import type { Metadata } from "next";
import { CrmComingSoon } from "@/components/crm/CrmComingSoon";

export const metadata: Metadata = { title: "Quotations | CRM" };

export default function CrmQuotationsPage() {
  return <CrmComingSoon title="Quotations" />;
}
