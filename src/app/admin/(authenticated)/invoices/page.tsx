import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InvoiceHistory } from "@/components/crm/InvoiceHistory";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Invoice History | Admin",
  description: "Search, filter, view and download tax invoices issued for successful payments.",
};

export default async function AdminInvoicesPage() {
  // The admin layout already gates the section; the API enforces payments.view
  // (+ service scope) on every call. This only avoids a screen that can't load.
  const session = await getStaffSession();
  if (!session) redirect("/crm/login?from=/admin/invoices");
  if (!hasPermission(session, "payments.view")) redirect("/admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Invoice History</h1>
        <p className="text-sm text-ink-tertiary">
          The tax-invoice register across all services. Filter by date, financial year, service, method or refund status, then view,
          download, export as CSV, or download the matching PDFs as a ZIP.
        </p>
      </div>
      <InvoiceHistory />
    </div>
  );
}
