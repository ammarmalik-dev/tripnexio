"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { toast } from "@/components/ui/Toaster";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { ApiError, getJson, patchJson } from "@/lib/api/client";
import { formatCurrency } from "@/lib/format-currency";
import { cn } from "@/lib/cn";

interface EditableInvoice {
  invoiceNumber: string;
  feeLabel: string;
  edited: boolean;
  lines: { description: string; quantity: number; governmentFee: number; serviceFee: number }[];
  gstAmount: number;
  couponDiscount: number;
  gatewayFee: number;
  grandTotal: number;
}

interface LineDraft {
  description: string;
  quantity: string;
  governmentFee: string;
  serviceFee: string;
}

const num = (value: string) => (value.trim() === "" ? 0 : Number(value));

/**
 * Client doc 2026-10-15 (G6) — Admin edits an issued invoice later: each line's
 * Govt./Vendor/Airline fee and service fee, and the GST amount. Saved with a
 * reason and audited; "Reset" goes back to the computed invoice. The payment
 * itself never changes — only what the invoice shows.
 */
export function InvoiceEditDialog({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const [invoice, setInvoice] = useState<EditableInvoice | null>(null);
  const [error, setError] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [gst, setGst] = useState("0");
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<EditableInvoice>(`/api/payments/${paymentId}/invoice-edit`);
        if (cancelled) return;
        setInvoice(result);
        setLines(result.lines.map((line) => ({ description: line.description, quantity: String(line.quantity), governmentFee: String(line.governmentFee), serviceFee: String(line.serviceFee) })));
        setGst(String(result.gstAmount));
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof ApiError ? loadError.message : "Couldn't load the invoice.");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  const update = (index: number, patch: Partial<LineDraft>) => setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  const total =
    lines.reduce((sum, line) => sum + num(line.governmentFee) + num(line.serviceFee), 0) - (invoice?.couponDiscount ?? 0) + num(gst) + (invoice?.gatewayFee ?? 0);

  const save = async (reset: boolean) => {
    const values = lines.map((line) => ({ description: line.description.trim(), quantity: Math.max(1, Math.round(num(line.quantity))), governmentFee: num(line.governmentFee), serviceFee: num(line.serviceFee) }));
    if (!reset && (values.some((line) => !line.description || line.governmentFee < 0 || line.serviceFee < 0) || num(gst) < 0)) {
      toast.error("Each line needs a description, and amounts can't be negative.");
      return;
    }
    const reason = await confirm({
      title: reset ? "Reset this invoice?" : `Save the edited invoice ${invoice?.invoiceNumber ?? ""}?`,
      description: reset ? "The invoice goes back to the figures computed from the booking." : `New grand total ${formatCurrency(total)}. The payment itself doesn't change.`,
      confirmLabel: reset ? "Reset Invoice" : "Save Invoice",
    });
    if (!reason) return;
    setSaving(true);
    try {
      await patchJson(`/api/payments/${paymentId}/invoice-edit`, reset ? { reset: true, reason } : { lines: values, gstAmount: num(gst), reason });
      toast.success(reset ? "Invoice reset." : "Invoice saved.");
      onClose();
    } catch (saveError) {
      toast.error(saveError instanceof ApiError ? saveError.message : "Couldn't save the invoice.");
    } finally {
      setSaving(false);
    }
  };

  const input = (value: string, onChange: (value: string) => void, label: string, type: "text" | "number" = "number") => (
    <input
      type={type}
      min={type === "number" ? 0 : undefined}
      step={type === "number" ? "0.01" : undefined}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn(fieldControlClass, fieldBorderClass(false), "h-9 text-sm")}
    />
  );

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="invoice-edit-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-xl border border-hairline bg-surface-1 p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="invoice-edit-title" className="text-base font-semibold text-ink-heading">
              Edit invoice {invoice?.invoiceNumber ?? ""}
            </h2>
            <p className="text-xs text-ink-tertiary">Fee, service fee and GST as they should appear on the invoice. Saved with a reason and recorded in the audit log.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-ink-tertiary hover:text-ink-primary">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {error ? (
          <ErrorState title="Couldn't load the invoice" description={error} />
        ) : !invoice ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2fr)_60px_repeat(2,minmax(0,1fr))_36px] gap-2 px-1 text-xs font-medium text-ink-secondary sm:grid">
              <span>Description</span>
              <span>Qty</span>
              <span>{invoice.feeLabel} (₹)</span>
              <span>Service fee (₹)</span>
              <span />
            </div>
            {lines.map((line, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 rounded-md bg-surface-2 p-2 sm:grid-cols-[minmax(0,2fr)_60px_repeat(2,minmax(0,1fr))_36px]">
                {input(line.description, (value) => update(index, { description: value }), `Description of line ${index + 1}`, "text")}
                {input(line.quantity, (value) => update(index, { quantity: value }), `Quantity of line ${index + 1}`)}
                {input(line.governmentFee, (value) => update(index, { governmentFee: value }), `${invoice.feeLabel} of line ${index + 1}`)}
                {input(line.serviceFee, (value) => update(index, { serviceFee: value }), `Service fee of line ${index + 1}`)}
                <button
                  type="button"
                  disabled={lines.length === 1}
                  onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                  aria-label={`Remove line ${index + 1}`}
                  className="flex h-9 items-center justify-center rounded-md text-ink-tertiary hover:text-error disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={() => setLines((current) => [...current, { description: "", quantity: "1", governmentFee: "0", serviceFee: "0" }])}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add line
            </Button>
            <div className="flex flex-wrap items-end justify-between gap-3 border-t border-hairline pt-3">
              <label className="flex w-40 flex-col gap-1 text-xs text-ink-secondary">
                <span className="font-medium">GST amount (₹)</span>
                {input(gst, setGst, "GST amount")}
              </label>
              <div className="text-right text-sm text-ink-tertiary">
                {invoice.couponDiscount > 0 ? <p>Coupon − {formatCurrency(invoice.couponDiscount)}</p> : null}
                {invoice.gatewayFee > 0 ? <p>Gateway fee {formatCurrency(invoice.gatewayFee)}</p> : null}
                <p>
                  Grand total <span className="text-base font-semibold text-ink-heading">{formatCurrency(total)}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {invoice.edited ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => void save(true)} disabled={saving}>
                  Reset to computed
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => void save(false)} isLoading={saving}>
                Save Invoice
              </Button>
            </div>
          </>
        )}
        {dialog}
      </div>
    </div>
  );
}
