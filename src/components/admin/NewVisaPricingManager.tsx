"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface CountryData {
  id: string;
  name: string;
  active: boolean;
}

interface PricingData {
  id: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  processingType: "normal" | "urgent";
  adultPrice: number;
  childPrice: number;
  infantPrice: number;
  active: boolean;
  displayOrder: number;
}

type FetchState = "loading" | "success" | "error";
type FieldErrors = Record<string, string[] | undefined>;

interface FormState {
  adultPrice: string;
  childPrice: string;
  infantPrice: string;
  displayOrder: string;
}

function toFormState(row: PricingData): FormState {
  return {
    adultPrice: String(row.adultPrice),
    childPrice: String(row.childPrice),
    infantPrice: String(row.infantPrice),
    displayOrder: String(row.displayOrder),
  };
}

function toPayload(form: FormState) {
  return {
    adultPrice: Number(form.adultPrice),
    childPrice: Number(form.childPrice),
    infantPrice: Number(form.infantPrice),
    displayOrder: Number(form.displayOrder) || 0,
  };
}

function RateFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  errors: FieldErrors;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        label="Adult price (₹)"
        name="adultPrice"
        type="number"
        min={0}
        value={form.adultPrice}
        onChange={(event) => onChange({ ...form, adultPrice: event.target.value })}
        error={errors.adultPrice?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Child price (₹)"
        name="childPrice"
        type="number"
        min={0}
        value={form.childPrice}
        onChange={(event) => onChange({ ...form, childPrice: event.target.value })}
        error={errors.childPrice?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Infant price (₹)"
        name="infantPrice"
        type="number"
        min={0}
        value={form.infantPrice}
        onChange={(event) => onChange({ ...form, infantPrice: event.target.value })}
        error={errors.infantPrice?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Display Order"
        name="displayOrder"
        type="number"
        value={form.displayOrder}
        onChange={(event) => onChange({ ...form, displayOrder: event.target.value })}
        error={errors.displayOrder?.[0]}
        disabled={disabled}
      />
    </div>
  );
}

function PricingCard({ row, onSaved }: { row: PricingData; onSaved: (row: PricingData) => void }) {
  const [form, setForm] = useState<FormState>(toFormState(row));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(row));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<PricingData>(`/api/admin/new-visa-pricing/${row.id}`, toPayload(form));
      toast.success(`${updated.countryName} (${updated.processingType}) updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this rate. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const updated = await patchJson<PricingData>(`/api/admin/new-visa-pricing/${row.id}`, { active: !row.active });
      toast.success(updated.active ? "Enabled." : "Disabled.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update. Please try again.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-heading">
            {row.countryName} · {row.processingType === "urgent" ? "Express" : "Normal"}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              row.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
            )}
          >
            {row.active ? "Active" : "Disabled"}
          </span>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggle()} isLoading={toggling}>
          {row.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <RateFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewPricingForm({ countries, onCreated }: { countries: CountryData[]; onCreated: (row: PricingData) => void }) {
  const [countryId, setCountryId] = useState("");
  const [processingType, setProcessingType] = useState<"normal" | "urgent">("normal");
  const [form, setForm] = useState<FormState>({ adultPrice: "", childPrice: "", infantPrice: "", displayOrder: "0" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<PricingData>("/api/admin/new-visa-pricing", { countryId, processingType, ...toPayload(form) });
      toast.success(`${created.countryName} (${created.processingType}) added.`);
      onCreated(created);
      setCountryId("");
      setForm({ adultPrice: "", childPrice: "", infantPrice: "", displayOrder: "0" });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this rate. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Add Pricing Rule</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Country" htmlFor="new-visa-pricing-country" error={errors.countryId?.[0]} required>
          <select
            id="new-visa-pricing-country"
            value={countryId}
            onChange={(event) => setCountryId(event.target.value)}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.countryId))}
            disabled={creating}
          >
            <option value="" disabled>
              Select a country
            </option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Processing Type" htmlFor="new-visa-pricing-processing" error={errors.processingType?.[0]} required>
          <select
            id="new-visa-pricing-processing"
            value={processingType}
            onChange={(event) => setProcessingType(event.target.value as "normal" | "urgent")}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.processingType))}
            disabled={creating}
          >
            <option value="normal">Normal</option>
            <option value="urgent">Express</option>
          </select>
        </FormField>
      </div>
      <RateFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCreate()}
          isLoading={creating}
          disabled={!countryId || form.adultPrice === "" || form.childPrice === "" || form.infantPrice === ""}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Pricing Rule
        </Button>
      </div>
    </div>
  );
}

export function NewVisaPricingManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [rows, setRows] = useState<PricingData[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const [pricingRows, countryList] = await Promise.all([
          getJson<PricingData[]>("/api/admin/new-visa-pricing"),
          getJson<CountryData[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setRows(pricingRows);
        setCountries(countryList);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load pricing. Please try again.");
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
          <Skeleton key={index} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load pricing"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const activeCountries = countries.filter((c) => c.active);

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <EmptyState title="No pricing configured yet" description="Add the first rate using the form below." />
      ) : (
        rows.map((row) => (
          <PricingCard
            key={row.id}
            row={row}
            onSaved={(updated) => setRows((current) => current.map((r) => (r.id === updated.id ? updated : r)))}
          />
        ))
      )}
      <NewPricingForm countries={activeCountries} onCreated={(created) => setRows((current) => [...current, created])} />
    </div>
  );
}
