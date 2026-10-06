import type { Metadata } from "next";
import Link from "next/link";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "My Profile", robots: { index: false, follow: false } };

/** Client corrections 2026-10-05 — My Profile: the customer's own contact details and a password reset. */
export default async function AccountProfilePage() {
  const session = await getCustomerSession();
  if (!session) return null;
  const customer = await db.customer.findUnique({ where: { id: session.id }, select: { createdAt: true, passwordHash: true } });

  const rows: [string, string][] = [
    ["Name", session.name],
    ["Mobile", session.mobile],
    ["Email", session.email ?? "—"],
    ["Customer since", customer ? customer.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"],
  ];

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-hairline bg-surface-1 p-6">
        <h2 className="text-lg font-semibold text-ink-heading">My Profile</h2>
        <dl className="mt-4 flex flex-col divide-y divide-hairline text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex flex-wrap justify-between gap-3 py-3">
              <dt className="text-ink-tertiary">{label}</dt>
              <dd className="font-medium text-ink-primary">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-ink-tertiary">
          To change your name, mobile or email, please contact our <Link href="/contact" className="text-ink-accent underline">support team</Link> so your bookings stay linked to you.
        </p>
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
    </div>
  );
}
