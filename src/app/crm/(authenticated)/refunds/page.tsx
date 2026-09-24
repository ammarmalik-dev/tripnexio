import type { Metadata } from "next";
import { Suspense } from "react";
import { RefundsTable } from "@/components/crm/RefundsTable";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Refunds | Internal Dashboard" };

export default async function CrmRefundsPage() {
  const session = await getStaffSession();
  const canApproveRefunds = hasPermission(session, "refunds.approve");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Refunds</h1>
        <p className="text-sm text-ink-tertiary">
          Every refund calculated from a successful payment. Initiate a new one from that payment&apos;s detail panel.
        </p>
      </div>
      <Suspense>
        <RefundsTable canApproveRefunds={canApproveRefunds} />
      </Suspense>
    </div>
  );
}
