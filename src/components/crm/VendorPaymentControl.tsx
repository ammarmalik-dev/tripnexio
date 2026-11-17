"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { patchJson, ApiError } from "@/lib/api/client";
import { formatRupees } from "@/lib/format-currency";
import { cn } from "@/lib/cn";

/**
 * Client doc 16 Nov (I10) — the booking's vendor / sponsor payment: Credit (still owed) or Paid, with the amount paid,
 * date and transaction reference. Finance staff only (the API enforces finance.manage).
 */
export function VendorPaymentControl({
  bookingId,
  vendorCost,
  payment,
  onSaved,
}: {
  bookingId: string;
  vendorCost: number;
  payment: { paidAmount: number; paidAt: string | null; reference: string | null };
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(payment.paidAmount || vendorCost));
  const [date, setDate] = useState(() => (payment.paidAt ? payment.paidAt.slice(0, 10) : new Date().toISOString().slice(0, 10)));
  const [reference, setReference] = useState(payment.reference ?? "");
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const outstanding = Math.max(0, vendorCost - payment.paidAmount);
  const paid = vendorCost > 0 && outstanding < 0.01;
  const control = cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm");

  const save = async () => {
    const reason = await confirm({ title: "Record the vendor payment?", description: `Paid to the vendor so far: ${formatRupees(Number(amount) || 0)}.`, confirmLabel: "Save" });
    if (!reason) return;
    setSaving(true);
    try {
      await patchJson(`/api/bookings/${bookingId}/vendor-payment`, { paidAmount: Number(amount) || 0, paidAt: date, reference: reference.trim() || undefined, reason });
      toast.success("Vendor payment recorded.");
      setEditing(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the vendor payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-ink-heading">Vendor payment</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", paid ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
          {paid ? "Paid" : "Credit"}
        </span>
      </div>
      <p className="text-xs text-ink-secondary">
        Paid {formatRupees(payment.paidAmount)} of {formatRupees(vendorCost)} · Outstanding {formatRupees(outstanding)}
        {payment.reference ? ` · Ref ${payment.reference}` : ""}
      </p>
      {editing ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input aria-label="Amount paid to the vendor" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))} className={control} />
          <input aria-label="Payment date" type="date" value={date} onChange={(event) => setDate(event.target.value)} className={control} />
          <input aria-label="Transaction reference" placeholder="Transaction ref" value={reference} onChange={(event) => setReference(event.target.value)} className={control} maxLength={80} />
          <div className="flex gap-2 sm:col-span-3">
            <Button type="button" size="sm" onClick={() => void save()} isLoading={saving}>
              Save
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => setEditing(true)}>
          Record vendor payment
        </Button>
      )}
      {dialog}
    </div>
  );
}
