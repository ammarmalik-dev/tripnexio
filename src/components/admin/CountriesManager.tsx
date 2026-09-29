"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { countryFlag } from "@/lib/countries/flag";

interface CountryData {
  id: string;
  code: string;
  name: string;
  flagOverride: string | null;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface CountryFormState {
  code: string;
  name: string;
  flagOverride: string;
  displayOrder: string;
}

const EMPTY_FORM: CountryFormState = {
  code: "",
  name: "",
  flagOverride: "",
  displayOrder: "0",
};

function toFormState(country: CountryData): CountryFormState {
  return {
    code: country.code,
    name: country.name,
    flagOverride: country.flagOverride ?? "",
    displayOrder: String(country.displayOrder),
  };
}

/** P23 — renders a country's flag: an Admin image override as an <img>, else the emoji. */
function FlagBadge({ code, flagOverride, className }: { code: string; flagOverride?: string | null; className?: string }) {
  const flag = countryFlag({ code, flagOverride });
  if (flag.kind === "image") {
    // Admin-supplied arbitrary URL (any host), so a plain <img> rather than next/image's domain allow-list.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={flag.value} alt="" aria-hidden="true" className={cn("inline-block h-5 w-7 rounded-sm object-cover", className)} />;
  }
  return (
    <span aria-hidden="true" className={cn("text-xl leading-none", className)}>
      {flag.value}
    </span>
  );
}

function CountryFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: CountryFormState;
  onChange: (next: CountryFormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        label="Name"
        name="name"
        placeholder="e.g. United Arab Emirates"
        value={form.name}
        onChange={(event) => onChange({ ...form, name: event.target.value })}
        error={errors.name?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Code"
        name="code"
        placeholder="e.g. UAE"
        value={form.code}
        onChange={(event) => onChange({ ...form, code: event.target.value.toUpperCase() })}
        error={errors.code?.[0]}
        disabled={disabled}
      />
      <div className="flex flex-col gap-1.5">
        <TextField
          label="Flag override (optional)"
          name="flagOverride"
          placeholder="An emoji, or an image URL (https://…)"
          value={form.flagOverride}
          onChange={(event) => onChange({ ...form, flagOverride: event.target.value })}
          error={errors.flagOverride?.[0]}
          disabled={disabled}
        />
        <p className="flex items-center gap-2 text-xs text-ink-tertiary">
          Auto flag from the code: <FlagBadge code={form.code} className="text-base" />
          {form.flagOverride.trim() ? (
            <>
              · Shown: <FlagBadge code={form.code} flagOverride={form.flagOverride} className="text-base" />
            </>
          ) : null}
        </p>
      </div>
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

function buildPayload(form: CountryFormState) {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    flagOverride: form.flagOverride.trim() || null,
    displayOrder: Number(form.displayOrder) || 0,
  };
}

function CountryCard({ country, onSaved }: { country: CountryData; onSaved: (country: CountryData) => void }) {
  const [form, setForm] = useState<CountryFormState>(toFormState(country));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(country));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<CountryData>(`/api/admin/countries/${country.id}`, buildPayload(form));
      toast.success(`Country "${updated.name}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this country. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<CountryData>(`/api/admin/countries/${country.id}`, { active: !country.active });
      toast.success(updated.active ? `${updated.name} enabled.` : `${updated.name} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this country. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlagBadge code={country.code} flagOverride={country.flagOverride} />
          <span className="text-sm font-semibold text-ink-heading">{country.name}</span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              country.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
            )}
          >
            {country.active ? "Active" : "Disabled"}
          </span>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {country.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <CountryFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewCountryForm({ onCreated }: { onCreated: (country: CountryData) => void }) {
  const [form, setForm] = useState<CountryFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<CountryData>("/api/admin/countries", buildPayload(form));
      toast.success(`Country "${created.name}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this country. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.name.trim() && form.code.trim();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Country</h2>
      <CountryFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Country
        </Button>
      </div>
    </div>
  );
}

export function CountriesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<CountryData[]>("/api/admin/countries");
        if (cancelled) return;
        setCountries(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load countries. Please try again.");
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
        title="Couldn't load countries"
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
      {countries.length === 0 ? (
        <EmptyState title="No countries yet" description="Add the first one using the form below." />
      ) : (
        countries.map((country) => (
          <CountryCard
            key={country.id}
            country={country}
            onSaved={(updated) => setCountries((current) => current.map((c) => (c.id === updated.id ? updated : c)))}
          />
        ))
      )}
      <NewCountryForm onCreated={(created) => setCountries((current) => [...current, created])} />
    </div>
  );
}
