"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { COUPON_TYPE_OPTIONS } from "@/lib/crm/labels";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { CouponType } from "../../generated/prisma/enums";

interface CouponConfigData {
  abandonedCouponEnabled: boolean;
  abandonedAfterHours: number | null;
  abandonedCouponType: CouponType | null;
  abandonedCouponValue: string | null;
  abandonedCouponMaxDiscount: string | null;
  abandonedCouponValidDays: number | null;
}

interface FormState {
  enabled: boolean;
  afterHours: string;
  type: CouponType | "";
  value: string;
  maxDiscount: string;
  validDays: string;
}

type FetchState = "loading" | "success" | "error";

function toForm(config: CouponConfigData): FormState {
  return {
    enabled: config.abandonedCouponEnabled,
    afterHours: config.abandonedAfterHours == null ? "" : String(config.abandonedAfterHours),
    type: config.abandonedCouponType ?? "",
    value: config.abandonedCouponValue ?? "",
    maxDiscount: config.abandonedCouponMaxDiscount ?? "",
    validDays: config.abandonedCouponValidDays == null ? "" : String(config.abandonedCouponValidDays),
  };
}

const toNullableNumber = (raw: string): number | null => (raw.trim() === "" ? null : Number(raw));

/**
 * P24 — Admin toggle + settings for the abandoned-quotation coupon
 * automation (n8n → POST /api/automation/abandoned-quote-coupons). Every
 * value is Admin-set; the job does nothing until enabled AND configured.
 */
export function AbandonedCouponConfigCard() {
  const [state, setState] = useState<FetchState>("loading");
  const [saved, setSaved] = useState<FormState | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [errorMessage, setErrorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<CouponConfigData>("/api/admin/coupon-config");
        if (cancelled) return;
        const next = toForm(result);
        setSaved(next);
        setForm(next);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load the abandoned-quotation coupon settings.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") return <Skeleton className="h-64 w-full max-w-2xl" />;

  if (state === "error" || !form || !saved) {
    return (
      <ErrorState
        title="Couldn't load the abandoned-quotation coupon settings"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<CouponConfigData>("/api/admin/coupon-config", {
        abandonedCouponEnabled: form.enabled,
        abandonedAfterHours: toNullableNumber(form.afterHours),
        abandonedCouponType: form.type === "" ? null : form.type,
        abandonedCouponValue: toNullableNumber(form.value),
        abandonedCouponMaxDiscount: toNullableNumber(form.maxDiscount),
        abandonedCouponValidDays: toNullableNumber(form.validDays),
      });
      const next = toForm(updated);
      setSaved(next);
      setForm(next);
      toast.success(next.enabled ? "Abandoned-quotation coupons enabled." : "Abandoned-quotation coupon settings saved.");
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save these settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="abandoned-coupon-heading" className="flex max-w-2xl flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="abandoned-coupon-heading" className="text-sm font-semibold text-ink-heading">
          Abandoned-Quotation Coupon (automation)
        </h2>
        <span
          className={cn("rounded-full px-2.5 py-1 text-xs font-medium", saved.enabled ? "bg-success/10 text-success" : "bg-ink-primary/[0.06] text-ink-secondary")}
        >
          {saved.enabled ? "Enabled" : "Off"}
        </span>
      </div>
      <p className="text-xs text-ink-tertiary">
        When enabled, a background job sends one single-use coupon to a customer whose sent quotation expired, or whose
        payment is still unpaid, this many hours after the quote/payment was created. Never sent to converted, lost or
        closed leads, to customers who opted out of follow-ups, or more than once per lead. The coupon only works on that
        customer&apos;s own request.
      </p>
      <label className="flex items-center gap-2 text-sm text-ink-primary">
        <input
          type="checkbox"
          checked={form.enabled}
          disabled={saving}
          onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
          className="h-4 w-4 rounded border-hairline"
        />
        Enable abandoned-quotation coupons
      </label>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Send after (hours)"
          name="abandonedAfterHours"
          type="number"
          min={1}
          step={1}
          value={form.afterHours}
          onChange={(event) => setForm({ ...form, afterHours: event.target.value })}
          error={errors.abandonedAfterHours?.[0]}
          disabled={saving}
        />
        <FormField label="Coupon type" htmlFor="abandonedCouponType" error={errors.abandonedCouponType?.[0]}>
          <select
            id="abandonedCouponType"
            value={form.type}
            disabled={saving}
            onChange={(event) => setForm({ ...form, type: event.target.value as CouponType | "" })}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.abandonedCouponType))}
          >
            <option value="">Not set</option>
            {COUPON_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
        <TextField
          label={form.type === "PERCENTAGE" ? "Value (%)" : "Value (₹)"}
          name="abandonedCouponValue"
          type="number"
          step="0.01"
          value={form.value}
          onChange={(event) => setForm({ ...form, value: event.target.value })}
          error={errors.abandonedCouponValue?.[0]}
          disabled={saving}
        />
        <TextField
          label="Max discount (₹)"
          name="abandonedCouponMaxDiscount"
          type="number"
          step="0.01"
          placeholder="Leave blank for no cap"
          value={form.maxDiscount}
          onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })}
          error={errors.abandonedCouponMaxDiscount?.[0]}
          disabled={saving}
        />
        <TextField
          label="Coupon valid for (days)"
          name="abandonedCouponValidDays"
          type="number"
          min={1}
          step={1}
          value={form.validDays}
          onChange={(event) => setForm({ ...form, validDays: event.target.value })}
          error={errors.abandonedCouponValidDays?.[0]}
          disabled={saving}
        />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </section>
  );
}
