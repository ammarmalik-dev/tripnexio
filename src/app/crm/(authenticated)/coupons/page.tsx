import type { Metadata } from "next";
import { CrmCouponsList } from "@/components/crm/CrmCouponsList";
import { CrmCreateCouponForm } from "@/components/crm/CrmCreateCouponForm";
import { getEmployeeCouponCap } from "@/lib/settings/coupon-config";
import { getStaffSession } from "@/lib/auth/staff-session";
import { hasPermission } from "@/lib/auth/permissions";

export const metadata: Metadata = { title: "Coupons | Internal Dashboard" };

export default async function CrmCouponsPage() {
  const session = await getStaffSession();
  // Client testing 2026-10-09 (E3) — staff with quotations.edit can create a capped coupon here.
  const canCreate = session ? hasPermission(session, "quotations.edit") : false;
  const cap = canCreate ? await getEmployeeCouponCap() : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-heading">Coupons</h1>
        <p className="text-sm text-ink-tertiary">Coupons you can apply on a quotation right now. Bigger or general coupons are managed in Admin → Coupons.</p>
      </div>
      {canCreate && cap > 0 ? <CrmCreateCouponForm cap={cap} /> : null}
      <CrmCouponsList />
    </div>
  );
}
