import type { Metadata } from "next";
import { InvoiceConfigManager } from "@/components/admin/InvoiceConfigManager";

export const metadata: Metadata = { title: "Invoice Settings | Admin" };

export default function AdminInvoiceSettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Invoice Settings</h1>
        <p className="text-sm text-ink-tertiary">
          Company GST/SAC, logo, bank details, terms and authorised signatory — used on every Proforma and Tax Invoice.
          Company name/address/phone/email come from the site&apos;s own brand settings, not here.
        </p>
      </div>
      <InvoiceConfigManager />
    </div>
  );
}
