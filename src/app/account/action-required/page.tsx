import type { Metadata } from "next";
import { CheckCircle2, CreditCard } from "lucide-react";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { getActionRequired } from "@/lib/account/portal";
import { AccountDocumentsSection } from "@/components/account/AccountDocumentsSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/ButtonLink";

export const metadata: Metadata = { title: "Action Required", robots: { index: false, follow: false } };

/** Client corrections 2026-10-05 — everything waiting on the customer: payments to complete and documents to upload. */
export default async function AccountActionRequiredPage() {
  const session = await getCustomerSession();
  if (!session) return null;
  const { documents, payments } = await getActionRequired(session.id);

  if (documents.length === 0 && payments.length === 0) {
    return <EmptyState icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />} title="You're all set" description="Nothing needs your attention right now." />;
  }

  return (
    <div className="flex flex-col gap-8">
      {payments.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-ink-heading">Complete your payment</h2>
          {payments.map((payment) => (
            <div key={payment.bookingDbId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/30 bg-warning/5 px-5 py-4">
              <span className="flex items-center gap-2 text-sm font-medium text-ink-primary">
                <CreditCard className="h-4 w-4 text-warning" aria-hidden="true" />
                {payment.bookingId} is waiting for payment
              </span>
              <ButtonLink href={payment.payHref} size="sm">
                Pay now
              </ButtonLink>
            </div>
          ))}
        </section>
      ) : null}
      <AccountDocumentsSection documents={documents} />
    </div>
  );
}
