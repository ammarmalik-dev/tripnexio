import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { AccountNav } from "@/components/account/AccountNav";
import { getCustomerSession } from "@/lib/auth/get-customer-session";
import { getActionRequired } from "@/lib/account/portal";

/** Client corrections 2026-10-05 — the customer portal shell: greeting + tabs, every page behind the customer session. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const session = await getCustomerSession();
  if (!session) redirect("/login");
  const actions = await getActionRequired(session.id);

  return (
    <Container className="py-12 sm:py-16">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div>
          <p className="text-sm font-semibold tracking-wide text-ink-accent uppercase">My Account</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink-heading">Welcome back, {session.name.split(" ")[0]}</h1>
        </div>
        <AccountNav actionCount={actions.documents.length + actions.payments.length} />
        {children}
      </div>
    </Container>
  );
}
