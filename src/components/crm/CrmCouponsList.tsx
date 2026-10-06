"use client";

import { useEffect, useState } from "react";
import { Copy, Ticket } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { ApiError, getJson } from "@/lib/api/client";
import { COUPON_CATEGORY_LABELS } from "@/lib/crm/labels";
import type { CouponCategory, CouponType } from "../../generated/prisma/enums";

export interface CrmCoupon {
  id: string;
  code: string;
  type: CouponType;
  category: CouponCategory;
  value: string;
  maxDiscount: string | null;
  validUntil: string;
  usageLimit: number | null;
  usageCount: number;
}

export function couponValueLabel(coupon: Pick<CrmCoupon, "type" | "value">): string {
  return coupon.type === "PERCENTAGE" ? `${Number(coupon.value)}% off` : `₹${Number(coupon.value).toLocaleString("en-IN")} off`;
}

/** Client corrections 2026-10-05 — CRM → Coupons: the codes staff can apply on a quotation right now. */
export function CrmCouponsList() {
  const [coupons, setCoupons] = useState<CrmCoupon[]>([]);
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await getJson<CrmCoupon[]>("/api/crm/coupons");
        if (cancelled) return;
        setCoupons(rows);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load coupons.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") return <Skeleton className="h-40 w-full" />;
  if (state === "error") return <ErrorState description={errorMessage} />;
  if (coupons.length === 0) {
    return <EmptyState icon={<Ticket className="h-5 w-5" aria-hidden="true" />} title="No coupons available right now" description="Admin creates coupons in Admin → Coupons." />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {coupons.map((coupon) => (
        <article key={coupon.id} className="flex flex-col gap-2 rounded-2xl border border-hairline bg-surface-1 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-lg border border-dashed border-ink-accent/40 bg-ink-accent/[0.05] px-2.5 py-1 font-mono text-sm font-semibold text-ink-accent">{coupon.code}</span>
            <span className="text-base font-bold text-ink-heading">{couponValueLabel(coupon)}</span>
          </div>
          <p className="text-xs text-ink-secondary">
            {COUPON_CATEGORY_LABELS[coupon.category]}
            {coupon.maxDiscount ? ` · max ₹${Number(coupon.maxDiscount).toLocaleString("en-IN")}` : ""}
          </p>
          <p className="text-xs text-ink-tertiary">
            Valid till {new Date(coupon.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            {coupon.usageLimit ? ` · ${coupon.usageLimit - coupon.usageCount} uses left` : ""}
          </p>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => {
              void navigator.clipboard?.writeText(coupon.code).then(() => toast.success(`${coupon.code} copied — paste it in the quotation's Coupon Code.`));
            }}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy code
          </Button>
        </article>
      ))}
    </div>
  );
}
