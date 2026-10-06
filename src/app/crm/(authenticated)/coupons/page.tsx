import type { Metadata } from "next";
import { CrmCouponsList } from "@/components/crm/CrmCouponsList";

export const metadata: Metadata = { title: "Coupons | Internal Dashboard" };

export default function CrmCouponsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Coupons</h1>
        <p className="text-sm text-ink-tertiary">Coupons you can apply on a quotation right now. Admin manages them in Admin → Coupons.</p>
      </div>
      <CrmCouponsList />
    </div>
  );
}
