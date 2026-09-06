import type { Metadata } from "next";
import { CrmComingSoon } from "@/components/crm/CrmComingSoon";

export const metadata: Metadata = { title: "Payments | CRM" };

export default function CrmPaymentsPage() {
  return <CrmComingSoon title="Payments" />;
}
