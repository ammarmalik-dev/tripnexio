"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_OPTIONS, PAX_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType, PaxType } from "../../generated/prisma/enums";

const PAX_TYPE_OPTIONS = (Object.entries(PAX_TYPE_LABELS) as [PaxType, string][]).map(([value, label]) => ({ value, label }));

interface PricingRuleData {
  id: string;
  serviceType: ServiceType;
  paxType: PaxType;
  nationality: string | null;
  basePrice: string;
  additionalCharges: string;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  serviceType: ServiceType | "";
  paxType: PaxType | "";
  nationality: string;
  basePrice: string;
  additionalCharges: string;
}

const EMPTY_FORM: FormState = { serviceType: "", paxType: "", nationality: "", basePrice: "", additionalCharges: "0" };

function toFormState(rule: PricingRuleData): FormState {
  return {
    serviceType: rule.serviceType,
    paxType: rule.paxType,
    nationality: rule.nationality ?? "",
    basePrice: rule.basePrice,
    additionalCharges: rule.additionalCharges,
  };
}

function PricingFields({
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
      <FormField label="Service" htmlFor="serviceType" error={errors.serviceType?.[0]}>
        <select
          id="serviceType"
          value={form.serviceType}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, serviceType: event.target.value as ServiceType })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.serviceType))}
        >
          <option value="" disabled>
            Select a service
          </option>
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Passenger Type" htmlFor="paxType" error={errors.paxType?.[0]}>
        <select
          id="paxType"
          value={form.paxType}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, paxType: event.target.value as PaxType })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.paxType))}
        >
          <option value="" disabled>
            Select a passenger type
          </option>
          {PAX_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <TextField
        label="Nationality"
        name="nationality"
        placeholder="Leave blank to apply to all nationalities"
        value={form.nationality}
        onChange={(event) => onChange({ ...form, nationality: event.target.value })}
        error={errors.nationality?.[0]}
        disabled={disabled}
        hint="Optional — leave blank for a rule that applies to every nationality."
      />
      <TextField
        label="Base Price (₹)"
        name="basePrice"
        type="number"
        step="0.01"
        value={form.basePrice}
        onChange={(event) => onChange({ ...form, basePrice: event.target.value })}
        error={errors.basePrice?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Additional Charges (₹)"
        name="additionalCharges"
        type="number"
        step="0.01"
        value={form.additionalCharges}
        onChange={(event) => onChange({ ...form, additionalCharges: event.target.value })}
        error={errors.additionalCharges?.[0]}
        disabled={disabled}
        hint="e.g. service fee, processing charge."
      />
    </div>
  );
}

function buildPayload(form: FormState) {
  return {
    serviceType: form.serviceType || undefined,
    paxType: form.paxType || undefined,
    nationality: form.nationality.trim() === "" ? undefined : form.nationality.trim(),
    basePrice: form.basePrice === "" ? undefined : Number(form.basePrice),
    additionalCharges: form.additionalCharges === "" ? 0 : Number(form.additionalCharges),
  };
}

function PricingCard({ rule, onSaved }: { rule: PricingRuleData; onSaved: (rule: PricingRuleData) => void }) {
  const [form, setForm] = useState<FormState>(toFormState(rule));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(rule));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<PricingRuleData>(`/api/admin/pricing-rules/${rule.id}`, buildPayload(form));
      toast.success("Pricing rule updated.");
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this pricing rule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<PricingRuleData>(`/api/admin/pricing-rules/${rule.id}`, { active: !rule.active });
      toast.success(updated.active ? "Enabled." : "Disabled.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this pricing rule. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn("rounded-full px-2.5 py-1 text-xs font-medium", rule.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}
        >
          {rule.active ? "Active" : "Disabled"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {rule.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <PricingFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewPricingRuleForm({ onCreated }: { onCreated: (rule: PricingRuleData) => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<PricingRuleData>("/api/admin/pricing-rules", buildPayload(form));
      toast.success("Pricing rule created.");
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this pricing rule. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.serviceType && form.paxType && form.basePrice.trim() !== "";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Pricing Rule</h2>
      <PricingFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Pricing Rule
        </Button>
      </div>
    </div>
  );
}

export function PricingRulesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [rules, setRules] = useState<PricingRuleData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<PricingRuleData[]>("/api/admin/pricing-rules");
        if (cancelled) return;
        setRules(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load pricing rules. Please try again.");
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
        title="Couldn't load pricing rules"
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
      {rules.length === 0 ? (
        <EmptyState title="No pricing rules yet" description="Add the first one using the form below." />
      ) : (
        rules.map((rule) => (
          <PricingCard
            key={rule.id}
            rule={rule}
            onSaved={(updated) => setRules((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewPricingRuleForm onCreated={(created) => setRules((current) => [...current, created])} />
    </div>
  );
}
