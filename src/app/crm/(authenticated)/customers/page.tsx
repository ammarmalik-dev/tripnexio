import type { Metadata } from "next";
import { CustomersTable } from "@/components/crm/customers/CustomersTable";

export const metadata: Metadata = { title: "Customers | Internal Dashboard" };

export default function CrmCustomersPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Customers</h1>
        <p className="text-sm text-ink-tertiary">
          Every customer with their full history — search by name, mobile, email, passport number, or lead/booking reference.
        </p>
      </div>
      <CustomersTable />
    </div>
  );
}
