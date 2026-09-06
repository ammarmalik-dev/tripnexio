import type { Metadata } from "next";
import { RefundsTable } from "@/components/crm/RefundsTable";

export const metadata: Metadata = { title: "Refunds | CRM" };

export default function CrmRefundsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Refunds</h1>
        <p className="text-sm text-ink-tertiary">
          Every refund calculated from a successful payment. Initiate a new one from that payment's detail panel.
        </p>
      </div>
      <RefundsTable />
    </div>
  );
}
