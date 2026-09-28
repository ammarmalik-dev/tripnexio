import type { Metadata } from "next";
import { RefundConfigManager } from "@/components/admin/RefundConfigManager";

export const metadata: Metadata = { title: "Refund Configuration | Admin" };

export default function AdminRefundConfigPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Refund Configuration</h1>
        <p className="text-sm text-ink-tertiary">
          Per-service refund rules used by the CRM refund calculator: the full-refund window, fixed deductions before and
          after document validation, and the point after which no refund is possible.
        </p>
      </div>
      <RefundConfigManager />
    </div>
  );
}
