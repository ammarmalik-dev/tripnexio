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

interface CountryOption {
  id: string;
  name: string;
}

interface NationalityData {
  id: string;
  name: string;
  countryId: string;
  country: CountryOption;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

function CountrySelect({
  id,
  value,
  countries,
  onChange,
  disabled,
  error,
}: {
  id: string;
  value: string;
  countries: CountryOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <FormField label="Country" htmlFor={id} error={error}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(!!error))}
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
  );
}

function NationalityRow({
  nationality,
  countries,
  onSaved,
}: {
  nationality: NationalityData;
  countries: CountryOption[];
  onSaved: (n: NationalityData) => void;
}) {
  const [name, setName] = useState(nationality.name);
  const [countryId, setCountryId] = useState(nationality.countryId);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== nationality.name || countryId !== nationality.countryId;

  const save = async (patch: { name?: string; countryId?: string; active?: boolean }) => {
    setBusy(true);
    setError(undefined);
    try {
      const updated = await patchJson<NationalityData>(`/api/admin/nationalities/${nationality.id}`, patch);
      toast.success(`"${updated.name}" updated.`);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.name) setError(err.fieldErrors.name[0]);
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this nationality. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4 lg:flex-row lg:items-end">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Nationality" name={`name-${nationality.id}`} value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={busy} />
        <CountrySelect id={`country-${nationality.id}`} value={countryId} countries={countries} onChange={setCountryId} disabled={busy} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            nationality.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {nationality.active ? "Active" : "Hidden"}
        </span>
        <Button type="button" size="sm" onClick={() => void save({ name: name.trim(), countryId })} disabled={!dirty || busy}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void save({ active: !nationality.active })} disabled={busy}>
          {nationality.active ? "Hide" : "Show"}
        </Button>
      </div>
    </div>
  );
}

function NewNationalityForm({ countries, onCreated }: { countries: CountryOption[]; onCreated: (n: NationalityData) => void }) {
  const [name, setName] = useState("");
  const [countryId, setCountryId] = useState("");
  const [errors, setErrors] = useState<{ name?: string; countryId?: string }>({});
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<NationalityData>("/api/admin/nationalities", { name: name.trim(), countryId });
      toast.success(`"${created.name}" added.`);
      onCreated(created);
      setName("");
      setCountryId("");
    } catch (err) {
      if (err instanceof ApiError) setErrors({ name: err.fieldErrors?.name?.[0], countryId: err.fieldErrors?.countryId?.[0] });
      toast.error(err instanceof ApiError ? err.message : "Couldn't add this nationality. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-4 lg:flex-row lg:items-end">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="New nationality" name="new-nationality" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} disabled={creating} />
        <CountrySelect id="new-nationality-country" value={countryId} countries={countries} onChange={setCountryId} disabled={creating} error={errors.countryId} />
      </div>
      <Button type="button" size="sm" onClick={() => void create()} isLoading={creating} disabled={name.trim().length < 2 || !countryId}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add
      </Button>
    </div>
  );
}

export function NationalitiesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<NationalityData[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const [nationalities, countryRows] = await Promise.all([
          getJson<NationalityData[]>("/api/admin/nationalities"),
          getJson<CountryOption[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setItems(nationalities);
        setCountries(countryRows.map((country) => ({ id: country.id, name: country.name })));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load nationalities. Please try again.");
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
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load nationalities"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? (
        <EmptyState title="No nationalities yet" description="Add the first one below." />
      ) : (
        items.map((item) => (
          <NationalityRow
            key={item.id}
            nationality={item}
            countries={countries}
            onSaved={(updated) => setItems((current) => current.map((n) => (n.id === updated.id ? updated : n)))}
          />
        ))
      )}
      <NewNationalityForm
        countries={countries}
        onCreated={(created) => setItems((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))}
      />
    </div>
  );
}
