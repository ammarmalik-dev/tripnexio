import type { Metadata } from "next";
import { CustomerDetail } from "@/components/crm/customers/CustomerDetail";

export const metadata: Metadata = { title: "Customer 360 | Internal Dashboard" };

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CrmCustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  return <CustomerDetail customerId={id} />;
}
