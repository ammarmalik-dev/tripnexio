import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InvoiceHistory } from "@/components/crm/InvoiceHistory";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Invoice History | Internal Dashboard",
  description: "Search, filter, view and download tax invoices issued for successful payments.",
};

export default async function CrmInvoicesPage() {
  // The API enforces payments.view (+ service scope) on every call; this only
  // keeps staff without it from landing on a screen that can't load.
  const session = await getStaffSession();
  if (!session) redirect("/crm/login?from=/crm/invoices");
  if (!hasPermission(session, "payments.view")) redirect("/crm");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Invoice History</h1>
        <p className="text-sm text-ink-tertiary">
          Every invoice issued for a successful payment. Filter the register, view or download single invoices, export it as CSV, or
          download the matching PDFs as a ZIP.
        </p>
      </div>
      <InvoiceHistory />
    </div>
  );
}
