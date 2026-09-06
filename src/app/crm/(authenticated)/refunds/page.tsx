import type { Metadata } from "next";
import { CrmComingSoon } from "@/components/crm/CrmComingSoon";

export const metadata: Metadata = { title: "Refunds | CRM" };

export default function CrmRefundsPage() {
  return <CrmComingSoon title="Refunds" />;
}
