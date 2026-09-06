import type { Metadata } from "next";
import { CouponsManager } from "@/components/admin/CouponsManager";

export const metadata: Metadata = { title: "Coupons | Admin" };

export default function AdminCouponsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Coupons &amp; Discounts</h1>
        <p className="text-sm text-ink-tertiary">
          Discount codes with type, value, validity window, and usage limits. A few clearly-labeled SAMPLE codes are
          seeded for development — propose the real promotions for review before it replaces them.
        </p>
      </div>
      <CouponsManager />
    </div>
  );
}
