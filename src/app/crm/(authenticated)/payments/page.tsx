import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentsTable } from "@/components/crm/PaymentsTable";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = { title: "Payments | Internal Dashboard" };

export default function CrmPaymentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-heading">Payments</h1>
          <p className="text-sm text-ink-tertiary">Every payment across all bookings, with the manual mark-success stub.</p>
        </div>
        <ButtonLink href="/crm/payments/extra" variant="ghost" size="sm">
          Extra Payments
        </ButtonLink>
      </div>
      <Suspense>
        <PaymentsTable />
      </Suspense>
    </div>
  );
}
