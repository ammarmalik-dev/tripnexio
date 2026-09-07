import { Download } from "lucide-react";
import { buttonBaseClass, buttonVariantClass, buttonSizeClass } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const EXPORTS = [
  { label: "Customers", href: "/api/admin/export/customers", description: "Every customer record: name, mobile, email, created date." },
  { label: "Leads", href: "/api/admin/export/leads", description: "Every lead: reference, service, status, customer, assigned staff." },
  { label: "Bookings", href: "/api/admin/export/bookings", description: "Every booking: booking ID, lead reference, service, status, customer." },
  { label: "Payments", href: "/api/admin/export/payments", description: "Every payment: booking, customer, base/GST/gateway-fee amounts, status." },
];

/**
 * Plain native <a> tags (not Next.js's Link/ButtonLink) — these point at API
 * routes that respond with Content-Disposition: attachment, and a real
 * anchor triggers the browser's normal download behavior directly.
 */
export function DataExportPanel() {
  return (
    <div className="flex flex-col gap-4">
      {EXPORTS.map((item) => (
        <div key={item.href} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
          <div>
            <p className="text-sm font-semibold text-ink-heading">{item.label}</p>
            <p className="text-xs text-ink-tertiary">{item.description}</p>
          </div>
          <a href={item.href} className={cn(buttonBaseClass, buttonVariantClass.ghost, buttonSizeClass.sm)}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </a>
        </div>
      ))}
    </div>
  );
}
