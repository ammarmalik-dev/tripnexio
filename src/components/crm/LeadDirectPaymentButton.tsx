"use client";

import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { getJson, postJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { CopyLinkButton } from "./CopyLinkButton";
import { CouponCodeOptions } from "./CouponCodeOptions";

type Preview =
  | { available: true; totalPrice: number; extraCharges: number; couponDiscount: number; couponError: string | null; finalPayable: number }
  | { available: false; reason: string };

const rupees = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * Client corrections 2026-10-05 §7/§16 + testing 2026-10-09 (A2, E1) — New
 * Visa / OTB / Return Ticket are paid by a direct payment link from the lead
 * (no quotation). Shows the Admin-configured amount, optional permitted extra
 * charges and a coupon, and the final payable before the link is created;
 * the customer is sent the link automatically.
 */
export function LeadDirectPaymentButton({ leadId, onCreated }: { leadId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState("");
  const [coupon, setCoupon] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [creating, setCreating] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const { confirm, dialog } = useConfirmAction();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const query = new URLSearchParams();
      if (Number(extra) > 0) query.set("extraCharges", String(Number(extra)));
      if (coupon.trim()) query.set("couponCode", coupon.trim());
      try {
        const result = await getJson<Preview>(`/api/leads/${leadId}/payment-link${query.size ? `?${query}` : ""}`);
        if (!cancelled) setPreview(result);
      } catch {
        if (!cancelled) setPreview({ available: false, reason: "Couldn't check the configured price." });
      }
    }
    const timer = setTimeout(() => void load(), 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [leadId, extra, coupon]);

  if (payUrl) return <CopyLinkButton url={payUrl} label="Copy Payment Link" />;
  if (!preview) return null;
  if (!preview.available) {
    return <p className="max-w-xs text-xs text-warning">Direct payment link unavailable: {preview.reason}</p>;
  }

  if (!open) {
    return (
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Link2 className="h-4 w-4" aria-hidden="true" />
        Create Payment Link · {rupees(preview.finalPayable)}
      </Button>
    );
  }

  const create = async () => {
    const reason = await confirm({
      title: `Create a payment link for ${rupees(preview.finalPayable)}?`,
      description: "A booking is created with the lead's reference and the customer is sent the payment link on email and WhatsApp. It becomes an active booking only after the payment succeeds.",
      confirmLabel: "Create Payment Link",
    });
    if (!reason) return;
    setCreating(true);
    try {
      const result = await postJson<{ payUrl: string }>(`/api/leads/${leadId}/payment-link`, {
        ...(Number(extra) > 0 ? { extraCharges: Number(extra) } : {}),
        ...(coupon.trim() ? { couponCode: coupon.trim() } : {}),
        reason,
      });
      setPayUrl(result.payUrl);
      toast.success("Payment link created and sent to the customer.");
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create the payment link. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-ink-secondary">Configured amount (Admin)</span>
        <span className="font-semibold text-ink-heading">{rupees(preview.totalPrice)}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink-secondary">
          <span className="font-medium">Extra charges (₹)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
            placeholder="0"
            className={cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm")}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-secondary">
          <span className="font-medium">Coupon</span>
          <input
            list="lead-payment-coupons"
            value={coupon}
            onChange={(event) => setCoupon(event.target.value.toUpperCase())}
            placeholder="Optional"
            className={cn(fieldControlClass, fieldBorderClass(Boolean(preview.couponError)), "h-9 text-sm uppercase")}
          />
          <CouponCodeOptions id="lead-payment-coupons" />
        </label>
      </div>
      {preview.couponError ? <p className="text-xs text-error">{preview.couponError}</p> : null}
      <dl className="flex flex-col gap-1 border-t border-hairline pt-2 text-xs text-ink-secondary">
        {preview.extraCharges > 0 ? (
          <div className="flex justify-between">
            <dt>Extra charges</dt>
            <dd>+ {rupees(preview.extraCharges)}</dd>
          </div>
        ) : null}
        {preview.couponDiscount > 0 ? (
          <div className="flex justify-between text-success">
            <dt>Coupon discount</dt>
            <dd>− {rupees(preview.couponDiscount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between text-sm font-semibold text-ink-heading">
          <dt>Final payable</dt>
          <dd>{rupees(preview.finalPayable)}</dd>
        </div>
        <p className="text-[11px] text-ink-tertiary">GST and gateway fee, if configured, are added on the payment page.</p>
      </dl>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => void create()} isLoading={creating} disabled={Boolean(preview.couponError)}>
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Create &amp; send link
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={creating}>
          Cancel
        </Button>
      </div>
      {dialog}
    </div>
  );
}
