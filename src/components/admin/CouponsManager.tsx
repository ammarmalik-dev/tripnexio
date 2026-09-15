"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { COUPON_TYPE_OPTIONS, COUPON_CATEGORY_OPTIONS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { CouponType, CouponCategory } from "../../generated/prisma/enums";

interface CouponData {
  id: string;
  code: string;
  type: CouponType;
  category: CouponCategory;
  value: string;
  validFrom: string;
  validUntil: string;
  usageLimit: number | null;
  usageCount: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  code: string;
  type: CouponType | "";
  category: CouponCategory | "";
  value: string;
  validFrom: string;
  validUntil: string;
  usageLimit: string;
}

const EMPTY_FORM: FormState = { code: "", type: "", category: "", value: "", validFrom: "", validUntil: "", usageLimit: "" };

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function toFormState(coupon: CouponData): FormState {
  return {
    code: coupon.code,
    type: coupon.type,
    category: coupon.category,
    value: coupon.value,
    validFrom: toDateInputValue(coupon.validFrom),
    validUntil: toDateInputValue(coupon.validUntil),
    usageLimit: coupon.usageLimit == null ? "" : String(coupon.usageLimit),
  };
}

function CouponFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        label="Code"
        name="code"
        placeholder="e.g. WELCOME10"
        value={form.code}
        onChange={(event) => onChange({ ...form, code: event.target.value.toUpperCase() })}
        error={errors.code?.[0]}
        disabled={disabled}
      />
      <FormField label="Type" htmlFor="type" error={errors.type?.[0]}>
        <select
          id="type"
          value={form.type}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, type: event.target.value as CouponType })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.type))}
        >
          <option value="" disabled>
            Select a type
          </option>
          {COUPON_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Category"
        htmlFor="category"
        error={errors.category?.[0]}
        hint="Employee coupons are capped at the configured limit above, regardless of this coupon's own value."
      >
        <select
          id="category"
          value={form.category}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, category: event.target.value as CouponCategory })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.category))}
        >
          <option value="" disabled>
            Select a category
          </option>
          {COUPON_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <TextField
        label={form.type === "PERCENTAGE" ? "Value (%)" : "Value (₹)"}
        name="value"
        type="number"
        step="0.01"
        value={form.value}
        onChange={(event) => onChange({ ...form, value: event.target.value })}
        error={errors.value?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Usage Limit"
        name="usageLimit"
        type="number"
        placeholder="Leave blank for unlimited"
        value={form.usageLimit}
        onChange={(event) => onChange({ ...form, usageLimit: event.target.value })}
        error={errors.usageLimit?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Valid From"
        name="validFrom"
        type="date"
        value={form.validFrom}
        onChange={(event) => onChange({ ...form, validFrom: event.target.value })}
        error={errors.validFrom?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Valid Until"
        name="validUntil"
        type="date"
        value={form.validUntil}
        onChange={(event) => onChange({ ...form, validUntil: event.target.value })}
        error={errors.validUntil?.[0]}
        disabled={disabled}
      />
    </div>
  );
}

function buildPayload(form: FormState) {
  return {
    code: form.code.trim(),
    type: form.type || undefined,
    category: form.category || undefined,
    value: form.value === "" ? undefined : Number(form.value),
    validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
    validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
    usageLimit: form.usageLimit.trim() === "" ? null : Number(form.usageLimit),
  };
}

function CouponCard({ coupon, onSaved }: { coupon: CouponData; onSaved: (coupon: CouponData) => void }) {
  const [form, setForm] = useState<FormState>(toFormState(coupon));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(coupon));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<CouponData>(`/api/admin/coupons/${coupon.id}`, buildPayload(form));
      toast.success(`Coupon "${updated.code}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this coupon. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<CouponData>(`/api/admin/coupons/${coupon.id}`, { active: !coupon.active });
      toast.success(updated.active ? `${updated.code} enabled.` : `${updated.code} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this coupon. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn("rounded-full px-2.5 py-1 text-xs font-medium", coupon.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}
        >
          {coupon.active ? "Active" : "Disabled"}
        </span>
        <span className="rounded-full bg-ink-primary/[0.06] px-2.5 py-1 text-xs font-medium text-ink-secondary">
          {COUPON_CATEGORY_OPTIONS.find((o) => o.value === coupon.category)?.label}
        </span>
        <span className="text-xs text-ink-tertiary">
          Used {coupon.usageCount} time{coupon.usageCount === 1 ? "" : "s"}
          {coupon.usageLimit != null ? ` of ${coupon.usageLimit}` : " · unlimited"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {coupon.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <CouponFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewCouponForm({ onCreated }: { onCreated: (coupon: CouponData) => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<CouponData>("/api/admin/coupons", buildPayload(form));
      toast.success(`Coupon "${created.code}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this coupon. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.code.trim() && form.type && form.category && form.value.trim() !== "" && form.validFrom && form.validUntil;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Coupon</h2>
      <CouponFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Coupon
        </Button>
      </div>
    </div>
  );
}

/** ADMIN.md §25 (Step 22): "This should be an Admin configuration value, not permanent hard-coded logic." */
function EmployeeCouponCapCard() {
  const [state, setState] = useState<FetchState>("loading");
  const [cap, setCap] = useState("");
  const [savedCap, setSavedCap] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJson<{ employeeCouponCap: string }>("/api/admin/coupon-config")
      .then((result) => {
        if (cancelled) return;
        setCap(result.employeeCouponCap);
        setSavedCap(result.employeeCouponCap);
        setState("success");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await patchJson<{ employeeCouponCap: string }>("/api/admin/coupon-config", { employeeCouponCap: Number(cap) });
      toast.success("Employee coupon cap updated.");
      setCap(updated.employeeCouponCap);
      setSavedCap(updated.employeeCouponCap);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update the cap. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (state === "loading") return <Skeleton className="h-24 w-full max-w-md" />;
  if (state === "error") return null;

  return (
    <div className="flex max-w-md flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Employee Coupon Cap</h2>
      <p className="text-xs text-ink-tertiary">
        The maximum discount any Employee-category coupon can apply, regardless of its own configured value. Currently ₹500 per ADMIN.md §25.
      </p>
      <div className="flex items-end gap-2">
        <TextField label="Cap (₹)" name="employeeCouponCap" type="number" step="0.01" value={cap} onChange={(event) => setCap(event.target.value)} disabled={saving} className="flex-1" />
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={cap === savedCap || cap.trim() === ""}>
          Save
        </Button>
      </div>
    </div>
  );
}

export function CouponsManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [coupons, setCoupons] = useState<CouponData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<CouponData[]>("/api/admin/coupons");
        if (cancelled) return;
        setCoupons(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load coupons. Please try again.");
        setState("error");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load coupons"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <EmployeeCouponCapCard />
      {coupons.length === 0 ? (
        <EmptyState title="No coupons yet" description="Add the first one using the form below." />
      ) : (
        coupons.map((coupon) => (
          <CouponCard
            key={coupon.id}
            coupon={coupon}
            onSaved={(updated) => setCoupons((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewCouponForm onCreated={(created) => setCoupons((current) => [...current, created])} />
    </div>
  );
}
