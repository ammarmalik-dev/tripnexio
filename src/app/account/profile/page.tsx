import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { db } from "@/lib/db";
import { BillingDetailsForm } from "@/components/account/BillingDetailsForm";
import { ContactChangeForm, DeleteAccountForm } from "@/components/account/AccountSettings";

export const metadata: Metadata = { title: "My Profile", robots: { index: false, follow: false } };

/** Client corrections 2026-10-05 — My Profile: the customer's own contact details and a password reset. */
export default async function AccountProfilePage() {
  const session = await getCustomerSession();
  if (!session) return null;
  const customer = await db.customer.findUnique({
    where: { id: session.id },
    select: { createdAt: true, passwordHash: true, billingAddress: true, billingStateCode: true, gstin: true },
  });

  // Client doc 2026-10-15 (J7) — mobile and email can be changed here (confirmed by an emailed code).
  const rows: [string, string, ReactNode?][] = [
    ["Name", session.name],
    ["Mobile", session.mobile, <ContactChangeForm key="mobile" field="mobile" current={session.mobile} />],
    ["Email", session.email ?? "—", <ContactChangeForm key="email" field="email" current={session.email} />],
    ["Customer since", customer ? customer.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-hairline bg-surface-1 p-6">
        <h2 className="text-lg font-semibold text-ink-heading">My Profile</h2>
        <dl className="mt-4 flex flex-col divide-y divide-hairline text-sm">
          {rows.map(([label, value, action]) => (
            <div key={label} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <dt className="text-ink-tertiary">{label}</dt>
              <dd className="flex flex-wrap items-center justify-end gap-3 font-medium text-ink-primary">
                {value}
                {action}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink-tertiary">
          To change your name, please contact our <Link href="/contact" className="text-ink-accent underline">support team</Link>. Your bookings stay linked when you change your mobile or email.
        </p>
      </section>
      <section className="rounded-xl border border-hairline bg-surface-1 p-6">
        <h2 className="text-lg font-semibold text-ink-heading">Billing details</h2>
        <p className="mt-1 mb-4 text-sm text-ink-secondary">Printed on your invoices. Add a GSTIN only if you are booking for a business.</p>
        <BillingDetailsForm
          endpoint="/api/account/billing"
          initial={{
            billingAddress: customer?.billingAddress ?? null,
            billingStateCode: customer?.billingStateCode ?? null,
            gstin: customer?.gstin ?? null,
          }}
        />
      </section>
      <section className="rounded-xl border border-hairline bg-surface-1 p-6">
        <h2 className="text-lg font-semibold text-ink-heading">Password</h2>
        <p className="mt-1 text-sm text-ink-secondary">
          {customer?.passwordHash ? "Forgot it or want a new one? We'll email you a secure reset link." : "You signed in with Google. You can also set a password for email login."}
        </p>
        <Link href="/forgot-password" className="mt-3 inline-flex text-sm font-semibold text-ink-accent hover:underline">
          {customer?.passwordHash ? "Reset password" : "Set a password"}
        </Link>
      </section>
      <section className="rounded-xl border border-hairline bg-surface-1 p-6">
        <h2 className="text-lg font-semibold text-ink-heading">Delete account</h2>
        <div className="mt-2">
          <DeleteAccountForm />
        </div>
      </section>
    </div>
  );
}
