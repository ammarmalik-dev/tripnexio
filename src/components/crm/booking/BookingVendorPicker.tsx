"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/Toaster";
import { fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { ApiError, getJson, patchJson } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../../generated/prisma/enums";

export interface VendorChoice {
  id: string;
  name: string;
}

/**
 * Active vendors for a service (GET /api/vendors), for the booking vendor pickers. Empty while loading or on error.
 * With `bookingId`, only vendors covering the booking's sub-service (Admin handover §12).
 */
export function useServiceVendors(serviceType: ServiceType, bookingId?: string): VendorChoice[] {
  const [vendors, setVendors] = useState<VendorChoice[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const query = bookingId ? `&bookingId=${encodeURIComponent(bookingId)}` : "";
        const result = await getJson<VendorChoice[]>(`/api/vendors?service=${serviceType}${query}`);
        if (!cancelled) setVendors(result);
      } catch {
        if (!cancelled) setVendors([]);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [serviceType, bookingId]);
  return vendors;
}

/**
 * Client testing 2026-10-09 (E12) — set or change the vendor processing a
 * booking, from the booking's Vendor section. A reason is required (a vendor
 * change is audited).
 */
export function BookingVendorPicker({
  bookingId,
  serviceType,
  currentVendorId,
  onSaved,
}: {
  bookingId: string;
  serviceType: ServiceType;
  currentVendorId: string | null;
  onSaved: () => void;
}) {
  const vendors = useServiceVendors(serviceType, bookingId);
  const [open, setOpen] = useState(false);
  const [vendorId, setVendorId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" className="self-start" onClick={() => setOpen(true)}>
        Change vendor
      </Button>
    );
  }

  const save = async () => {
    if (!vendorId) {
      toast.error("Select a vendor.");
      return;
    }
    if (reason.trim().length < 5) {
      toast.error("Give a short reason (at least 5 characters).");
      return;
    }
    setSaving(true);
    try {
      await patchJson(`/api/bookings/${bookingId}/vendor`, { vendorId, reason: reason.trim() });
      toast.success("Vendor saved.");
      setOpen(false);
      setVendorId("");
      setReason("");
      onSaved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't save the vendor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-hairline bg-surface-2 p-3">
      <label htmlFor="booking-vendor-select" className="text-xs font-medium text-ink-heading">
        Vendor processing this booking
      </label>
      <select
        id="booking-vendor-select"
        value={vendorId}
        onChange={(event) => setVendorId(event.target.value)}
        disabled={saving}
        className={cn(fieldControlClass, fieldBorderClass(false), "h-10")}
      >
        <option value="">{vendors.length === 0 ? "No active vendors for this service" : "Select a vendor"}</option>
        {vendors
          .filter((vendor) => vendor.id !== currentVendorId)
          .map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
      </select>
      <label htmlFor="booking-vendor-reason" className="text-xs font-medium text-ink-heading">
        Reason
      </label>
      <input
        id="booking-vendor-reason"
        type="text"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={saving}
        placeholder="Why is the vendor being set or changed?"
        className={cn(fieldControlClass, fieldBorderClass(false), "h-10")}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void save()} isLoading={saving}>
          Save Vendor
        </Button>
      </div>
    </div>
  );
}

export interface RatedVendorChoice extends VendorChoice {
  /** Internal — only when the viewer may see vendor cost. */
  cost?: number;
  summary?: string;
}

/**
 * Client doc 2026-10-27 (C13) — the vendors with a rate for this booking (GET /api/bookings/[id]/vendor), for the
 * vendor question at Sent to Airlines / Applied to Embassy. When no vendor has a rate yet, every active vendor of the
 * service (staff then enter the cost).
 */
export function useBookingVendorRates(bookingId: string, serviceType: ServiceType): { vendors: RatedVendorChoice[]; rated: boolean } {
  const fallback = useServiceVendors(serviceType, bookingId);
  const [state, setState] = useState<{ vendors: RatedVendorChoice[]; rated: boolean }>({ vendors: [], rated: false });
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getJson<{ rated: boolean; vendors: RatedVendorChoice[] }>(`/api/bookings/${encodeURIComponent(bookingId)}/vendor`);
        if (!cancelled) setState(result);
      } catch {
        if (!cancelled) setState({ vendors: [], rated: false });
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);
  return state.rated ? state : { vendors: fallback, rated: false };
}

/** "Vendor name — ₹1,200 (₹600 × 2)" when the cost may be shown, else the name. */
export function ratedVendorLabel(vendor: RatedVendorChoice): string {
  if (vendor.cost === undefined) return vendor.name;
  return `${vendor.name} — ₹${vendor.cost.toLocaleString("en-IN")}${vendor.summary ? ` (${vendor.summary})` : ""}`;
}

/** Client doc 2026-10-27 (C13) — the required vendor select shown with the apply step's button. */
export function ApplyVendorSelect({
  id,
  label,
  bookingId,
  serviceType,
  value,
  onChange,
  disabled,
  error,
}: {
  id: string;
  label: string;
  bookingId: string;
  serviceType: ServiceType;
  value: string;
  onChange: (vendorId: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const { vendors, rated } = useBookingVendorRates(bookingId, serviceType);
  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-heading">
        {label} <span className="text-error">*</span>
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        className={cn(fieldControlClass, fieldBorderClass(Boolean(error)), "h-10")}
      >
        <option value="">{vendors.length === 0 ? "No active vendors for this service" : "Select a vendor"}</option>
        {vendors.map((vendor) => (
          <option key={vendor.id} value={vendor.id}>
            {ratedVendorLabel(vendor)}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-error">{error}</span> : null}
      <span className="text-xs text-ink-tertiary">
        {rated
          ? "Vendors with a rate for this booking — the chosen vendor's rate sets the vendor cost (P&L). Internal only."
          : "No vendor rate is set for this booking yet (Pricing Dashboard → vendor rates) — enter the vendor cost on the booking. Internal only."}
      </span>
    </div>
  );
}
