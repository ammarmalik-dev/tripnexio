import type { Metadata } from "next";
import { CrmComingSoon } from "@/components/crm/CrmComingSoon";

export const metadata: Metadata = { title: "Bookings | CRM" };

export default function CrmBookingsPage() {
  return <CrmComingSoon title="Bookings" />;
}
