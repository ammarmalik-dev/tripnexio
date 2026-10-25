"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import { couponValueLabel, type CrmCoupon } from "./CrmCouponsList";

/** Client corrections 2026-10-05 — the coupons staff can apply, as suggestions for the quote builder's Coupon Code field. */
/** `leadId` — only the codes valid for that lead's service (Admin handover §17). */
export function CouponCodeOptions({ id, leadId }: { id: string; leadId?: string }) {
  const [coupons, setCoupons] = useState<CrmCoupon[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await getJson<CrmCoupon[]>(leadId ? `/api/crm/coupons?leadId=${encodeURIComponent(leadId)}` : "/api/crm/coupons");
        if (!cancelled) setCoupons(rows);
      } catch {
        // No suggestions; typing a code still works.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [leadId]);
  return (
    <datalist id={id}>
      {coupons.map((coupon) => (
        <option key={coupon.id} value={coupon.code}>
          {couponValueLabel(coupon)}
        </option>
      ))}
    </datalist>
  );
}
