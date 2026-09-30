"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, patchJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { cn } from "@/lib/cn";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";

export interface ReturnTicketBookingView {
  cancellationFee: number | null;
  withinIssueWindow: boolean;
  otbApprovalPending: boolean;
  vendor: { id: string; name: string } | null;
  vendorCost: number | null;
  vendorReference: string | null;
  pnr: string | null;
  deliveredAt: string | null;
}

function fmt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * P17 — Return Verified Ticket operations on Booking detail
 * (Return_Verified_Ticket.md §7, §18-21; CRM.md §15): Issue Reservation
 * (only inside the 24h-before-travel window and never before a linked OTB is
 * approved) with its issue time and expected expiry, the vendor / vendor
 * cost / vendor reference / PNR staff record, and the delivery time. The
 * reservation PDF itself goes through Upload & Deliver below.
 */
export function ReturnTicketActionsPanel({
  bookingId,
  view,
  reservationIssuedAt,
  reservationExpiresAt,
  reservationExpired,
  onChanged,
}: {
  bookingId: string;
  view: ReturnTicketBookingView;
  reservationIssuedAt: string | null;
  reservationExpiresAt: string | null;
  reservationExpired: boolean;
  onChanged: () => void;
}) {
  const [issuing, setIssuing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    vendorId: view.vendor?.id ?? "",
    vendorCost: view.vendorCost === null ? "" : String(view.vendorCost),
    vendorReference: view.vendorReference ?? "",
    pnr: view.pnr ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const { confirm, dialog } = useConfirmAction();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<{ id: string; name: string }[]>("/api/vendors?service=RETURN_TICKET");
        if (cancelled) return;
        // Keep the booking's current vendor selectable even if it isn't tagged for this service.
        const current = view.vendor;
        setVendors(current && !result.some((v) => v.id === current.id) ? [current, ...result] : result);
      } catch {
        if (!cancelled) setVendors(view.vendor ? [view.vendor] : []);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [view.vendor]);

  const issueBlockedReason = reservationIssuedAt
    ? null
    : view.otbApprovalPending
      ? "Waiting for the linked OTB to be approved."
      : !view.withinIssueWindow
        ? "Opens 24 hours before travel."
        : null;

  const issue = async () => {
    setIssuing(true);
    try {
      await patchJson(`/api/bookings/${bookingId}/issue-reservation`, {});
      toast.success("Reservation issued. Upload the reservation PDF below to deliver it.");
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't issue the reservation.");
    } finally {
      setIssuing(false);
    }
  };

  const saveVendor = async () => {
    // Business Rules §14 — changing the vendor or vendor cost is a sensitive action; saving only the reference/PNR isn't.
    const vendorChanged =
      form.vendorId !== (view.vendor?.id ?? "") || (form.vendorCost.trim() === "" ? null : Number(form.vendorCost)) !== view.vendorCost;
    let reason: string | undefined;
    if (vendorChanged) {
      const confirmed = await confirm({
        title: "Change this booking's vendor?",
        description: `Vendor: ${vendors.find((v) => v.id === form.vendorId)?.name ?? "—"}, vendor cost ₹${form.vendorCost || "—"}. The internal margin is recomputed from the selected quote.`,
        confirmLabel: "Save Vendor",
      });
      if (!confirmed) return;
      reason = confirmed;
    }
    setSaving(true);
    setErrors({});
    try {
      await postJson(`/api/bookings/${bookingId}/return-ticket-action`, {
        action: "SAVE_VENDOR",
        vendorId: form.vendorId,
        vendorCost: form.vendorCost.trim() === "" ? Number.NaN : Number(form.vendorCost),
        vendorReference: form.vendorReference,
        pnr: form.pnr,
        reason,
      });
      toast.success("Vendor details saved.");
      onChanged();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors ?? {});
        toast.error(error.message);
      } else {
        toast.error("Couldn't save the vendor details.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink-heading">Return Ticket — reservation</h2>
        <span className="text-xs text-ink-tertiary">
          Cancellation fee: {view.cancellationFee !== null && view.cancellationFee > 0 ? `₹${view.cancellationFee.toLocaleString("en-IN")}` : "not set"} · no refund after forwarding
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-tertiary">Issued</dt>
          <dd className="font-medium text-ink-primary">{fmt(reservationIssuedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Expected expiry (internal)</dt>
          <dd className={cn("font-medium", reservationExpired ? "text-error" : "text-ink-primary")}>
            {fmt(reservationExpiresAt)}
            {reservationExpired ? " · expired" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-tertiary">Delivered to customer</dt>
          <dd className="font-medium text-ink-primary">{fmt(view.deliveredAt)}</dd>
        </div>
      </dl>

      {!reservationIssuedAt ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" size="sm" onClick={() => void issue()} isLoading={issuing} disabled={issueBlockedReason !== null}>
            Issue Reservation
          </Button>
          {issueBlockedReason ? <span className="text-xs text-warning">{issueBlockedReason}</span> : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-hairline pt-4">
        <h3 className="text-xs font-semibold tracking-wide text-ink-tertiary uppercase">Vendor (internal)</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm text-ink-secondary">
            Vendor
            <select
              value={form.vendorId}
              onChange={(event) => setForm({ ...form, vendorId: event.target.value })}
              className={cn(fieldControlClass, fieldBorderClass(Boolean(errors.vendorId)), "h-10 text-sm")}
              disabled={saving}
            >
              <option value="">Select a vendor</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            {errors.vendorId?.[0] ? <span className="text-xs text-error">{errors.vendorId[0]}</span> : null}
          </label>
          <TextField
            label="Vendor cost (₹)"
            name="rt-vendor-cost"
            type="number"
            min={0}
            value={form.vendorCost}
            onChange={(event) => setForm({ ...form, vendorCost: event.target.value })}
            error={errors.vendorCost?.[0]}
            disabled={saving}
          />
          <TextField
            label="Vendor reference"
            name="rt-vendor-ref"
            value={form.vendorReference}
            onChange={(event) => setForm({ ...form, vendorReference: event.target.value })}
            error={errors.vendorReference?.[0]}
            disabled={saving}
          />
          <TextField
            label="PNR / reservation reference"
            name="rt-pnr"
            value={form.pnr}
            onChange={(event) => setForm({ ...form, pnr: event.target.value })}
            error={errors.pnr?.[0]}
            disabled={saving}
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={() => void saveVendor()} isLoading={saving}>
            Save vendor details
          </Button>
        </div>
      </div>
      {dialog}
    </section>
  );
}
