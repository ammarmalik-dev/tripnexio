"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_OPTIONS, PAX_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType, PaxType } from "../../generated/prisma/enums";

const PAX_TYPE_OPTIONS = (Object.entries(PAX_TYPE_LABELS) as [PaxType, string][]).map(([value, label]) => ({ value, label }));
const PROCESSING_TYPE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
];

interface CountryData {
  id: string;
  name: string;
  active: boolean;
}

interface PricingRuleData {
  id: string;
  serviceType: ServiceType;
  countryId: string | null;
  country: { id: string; name: string; code: string } | null;
  processingType: string | null;
  paxType: PaxType;
  nationality: string | null;
  vendorCost: string;
  sellingPrice: string;
  additionalCharges: string;
  validityFrom: string | null;
  validityUntil: string | null;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  serviceType: ServiceType | "";
  countryId: string;
  processingType: "" | "normal" | "urgent";
  paxType: PaxType | "";
  nationality: string;
  vendorCost: string;
  sellingPrice: string;
  additionalCharges: string;
  validityFrom: string;
  validityUntil: string;
}

const EMPTY_FORM: FormState = {
  serviceType: "",
  countryId: "",
  processingType: "",
  paxType: "",
  nationality: "",
  vendorCost: "0",
  sellingPrice: "",
  additionalCharges: "0",
  validityFrom: "",
  validityUntil: "",
};

function toFormState(rule: PricingRuleData): FormState {
  return {
    serviceType: rule.serviceType,
    countryId: rule.countryId ?? "",
    processingType: (rule.processingType as "normal" | "urgent" | null) ?? "",
    paxType: rule.paxType,
    nationality: rule.nationality ?? "",
    vendorCost: rule.vendorCost,
    sellingPrice: rule.sellingPrice,
    additionalCharges: rule.additionalCharges,
    validityFrom: rule.validityFrom ? rule.validityFrom.slice(0, 10) : "",
    validityUntil: rule.validityUntil ? rule.validityUntil.slice(0, 10) : "",
  };
}

function PricingFields({
  form,
  onChange,
  errors,
  disabled,
  countries,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
  countries: CountryData[];
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
      <SelectField
        label="Country"
        name="countryId"
        placeholder="All countries (not country-specific)"
        options={countries.map((c) => ({ value: c.id, label: c.name }))}
        value={form.countryId}
        onChange={(event) => onChange({ ...form, countryId: event.target.value })}
        error={errors.countryId?.[0]}
        disabled={disabled}
        hint="Optional — leave unset for a rule not tied to a destination country."
      />
      <FormField label="Processing Type" htmlFor="processingType" error={errors.processingType?.[0]}>
        <select
          id="processingType"
          value={form.processingType}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, processingType: event.target.value as "" | "normal" | "urgent" })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.processingType))}
        >
          <option value="">Any / not applicable</option>
          {PROCESSING_TYPE_OPTIONS.map((option) => (
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
        label="Vendor Cost (₹)"
        name="vendorCost"
        type="number"
        step="0.01"
        value={form.vendorCost}
        onChange={(event) => onChange({ ...form, vendorCost: event.target.value })}
        error={errors.vendorCost?.[0]}
        disabled={disabled}
        hint="Internal — never shown to the customer."
      />
      <TextField
        label="Selling Price (₹)"
        name="sellingPrice"
        type="number"
        step="0.01"
        value={form.sellingPrice}
        onChange={(event) => onChange({ ...form, sellingPrice: event.target.value })}
        error={errors.sellingPrice?.[0]}
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
      <TextField
        label="Validity From"
        name="validityFrom"
        type="date"
        value={form.validityFrom}
        onChange={(event) => onChange({ ...form, validityFrom: event.target.value })}
        error={errors.validityFrom?.[0]}
        disabled={disabled}
        hint="Optional."
      />
      <TextField
        label="Validity Until"
        name="validityUntil"
        type="date"
        value={form.validityUntil}
        onChange={(event) => onChange({ ...form, validityUntil: event.target.value })}
        error={errors.validityUntil?.[0]}
        disabled={disabled}
        hint="Optional."
      />
    </div>
  );
}

function buildPayload(form: FormState) {
  return {
    serviceType: form.serviceType || undefined,
    countryId: form.countryId === "" ? undefined : form.countryId,
    processingType: form.processingType === "" ? undefined : form.processingType,
    paxType: form.paxType || undefined,
    nationality: form.nationality.trim() === "" ? undefined : form.nationality.trim(),
    vendorCost: form.vendorCost === "" ? 0 : Number(form.vendorCost),
    sellingPrice: form.sellingPrice === "" ? undefined : Number(form.sellingPrice),
    additionalCharges: form.additionalCharges === "" ? 0 : Number(form.additionalCharges),
    validityFrom: form.validityFrom === "" ? undefined : form.validityFrom,
    validityUntil: form.validityUntil === "" ? undefined : form.validityUntil,
  };
}

function PricingCard({
  rule,
  countries,
  onSaved,
}: {
  rule: PricingRuleData;
  countries: CountryData[];
  onSaved: (rule: PricingRuleData) => void;
}) {
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
      <PricingFields form={form} onChange={setForm} errors={errors} disabled={saving} countries={countries} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewPricingRuleForm({ countries, onCreated }: { countries: CountryData[]; onCreated: (rule: PricingRuleData) => void }) {
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

  const canSubmit = form.serviceType && form.paxType && form.sellingPrice.trim() !== "";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Pricing Rule</h2>
      <PricingFields form={form} onChange={setForm} errors={errors} disabled={creating} countries={countries} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Pricing Rule
        </Button>
      </div>
    </div>
  );
}

/**
 * Step 40 (Admin FINAL handover §4): "Use the existing Pricing module as
 * the central pricing control" — this is now the real price-computation
 * source for New Visa (and any future auto-priced service), not just a
 * staff-facing reference table. Deliberately does NOT cover OTB
 * (Airline.normalPrice/urgentPrice, keyed by airline not country) or
 * Return Ticket (ReturnTicketDestination.ratePerApplicant, flat rate,
 * currently no adult/child/infant split) — see PricingRule's own schema
 * doc comment for why those two were flagged rather than force-merged.
 */
export function PricingRulesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [rules, setRules] = useState<PricingRuleData[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [ruleList, countryList] = await Promise.all([
          getJson<PricingRuleData[]>("/api/admin/pricing-rules"),
          getJson<CountryData[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setRules(ruleList);
        setCountries(countryList.filter((c) => c.active));
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
          <Skeleton key={index} className="h-56 w-full" />
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
            countries={countries}
            onSaved={(updated) => setRules((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewPricingRuleForm countries={countries} onCreated={(created) => setRules((current) => [...current, created])} />
    </div>
  );
}
