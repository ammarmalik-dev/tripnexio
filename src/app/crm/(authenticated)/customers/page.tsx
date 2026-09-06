import type { Metadata } from "next";
import { CrmComingSoon } from "@/components/crm/CrmComingSoon";

export const metadata: Metadata = { title: "Customers | CRM" };

export default function CrmCustomersPage() {
  return <CrmComingSoon title="Customers" />;
}
