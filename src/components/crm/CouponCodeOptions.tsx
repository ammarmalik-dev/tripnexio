"use client";

import { useEffect, useState } from "react";
import { getJson } from "@/lib/api/client";
import { couponValueLabel, type CrmCoupon } from "./CrmCouponsList";

/** Client corrections 2026-10-05 — the coupons staff can apply, as suggestions for the quote builder's Coupon Code field. */
export function CouponCodeOptions({ id }: { id: string }) {
  const [coupons, setCoupons] = useState<CrmCoupon[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await getJson<CrmCoupon[]>("/api/crm/coupons");
        if (!cancelled) setCoupons(rows);
      } catch {
        // No suggestions; typing a code still works.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
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
