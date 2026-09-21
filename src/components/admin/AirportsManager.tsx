"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { useCountries, type CountryOption } from "@/lib/admin/use-countries";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

interface AirportData {
  id: string;
  name: string;
  code: string;
  country: string;
  city: string;
  countryId: string;
  countryRef: CountryOption;
  activeForA2AEntry: boolean;
  activeForA2AExit: boolean;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

/** Keeps the page responsive once a large CSV has been imported — search/filter narrows the rest. */
const MAX_VISIBLE_AIRPORTS = 50;

interface AirportFormState {
  name: string;
  code: string;
  country: string;
  city: string;
  countryId: string;
  activeForA2AEntry: boolean;
  activeForA2AExit: boolean;
  displayOrder: string;
}

const EMPTY_FORM: AirportFormState = {
  name: "",
  code: "",
  country: "",
  city: "",
  countryId: "",
  activeForA2AEntry: true,
  activeForA2AExit: true,
  displayOrder: "0",
};

function toFormState(airport: AirportData): AirportFormState {
  return {
    name: airport.name,
    code: airport.code,
    country: airport.country,
    city: airport.city,
    countryId: airport.countryId,
    activeForA2AEntry: airport.activeForA2AEntry,
    activeForA2AExit: airport.activeForA2AExit,
    displayOrder: String(airport.displayOrder),
  };
}

function AirportFields({
  form,
  onChange,
  errors,
  disabled,
  countryOptions,
}: {
  form: AirportFormState;
  onChange: (next: AirportFormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
  countryOptions: CountryOption[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        label="Name"
        name="name"
        value={form.name}
        onChange={(event) => onChange({ ...form, name: event.target.value })}
        error={errors.name?.[0]}
        disabled={disabled}
      />
      <TextField
        label="IATA Code"
        name="code"
        placeholder="e.g. DXB"
        value={form.code}
        onChange={(event) => onChange({ ...form, code: event.target.value.toUpperCase() })}
        error={errors.code?.[0]}
        disabled={disabled}
        maxLength={4}
      />
      <TextField
        label="Country"
        name="country"
        value={form.country}
        onChange={(event) => onChange({ ...form, country: event.target.value })}
        error={errors.country?.[0]}
        disabled={disabled}
      />
      <TextField
        label="City"
        name="city"
        value={form.city}
        onChange={(event) => onChange({ ...form, city: event.target.value })}
        error={errors.city?.[0]}
        disabled={disabled}
      />
      <FormField label="GCC Classification" htmlFor="countryId" error={errors.countryId?.[0]}>
        <select
          id="countryId"
          value={form.countryId}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, countryId: event.target.value })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.countryId))}
        >
          <option value="" disabled>
            Select a classification
          </option>
          {countryOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </FormField>
      <TextField
        label="Display Order"
        name="displayOrder"
        type="number"
        value={form.displayOrder}
        onChange={(event) => onChange({ ...form, displayOrder: event.target.value })}
        error={errors.displayOrder?.[0]}
        disabled={disabled}
      />
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={form.activeForA2AEntry}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, activeForA2AEntry: event.target.checked })}
        />
        Active for Airport-to-Airport Entry
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={form.activeForA2AExit}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, activeForA2AExit: event.target.checked })}
        />
        Active for Airport-to-Airport Exit
      </label>
    </div>
  );
}

function buildPayload(form: AirportFormState) {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    country: form.country.trim(),
    city: form.city.trim(),
    countryId: form.countryId || undefined,
    activeForA2AEntry: form.activeForA2AEntry,
    activeForA2AExit: form.activeForA2AExit,
    displayOrder: Number(form.displayOrder) || 0,
  };
}

function AirportCard({
  airport,
  onSaved,
  onDeleted,
  countryOptions,
}: {
  airport: AirportData;
  onSaved: (airport: AirportData) => void;
  onDeleted: (id: string) => void;
  countryOptions: CountryOption[];
}) {
  const [form, setForm] = useState<AirportFormState>(toFormState(airport));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(airport));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<AirportData>(`/api/admin/airports/${airport.id}`, buildPayload(form));
      toast.success(`Airport "${updated.name}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this airport. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<AirportData>(`/api/admin/airports/${airport.id}`, { active: !airport.active });
      toast.success(updated.active ? `${updated.name} enabled.` : `${updated.name} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this airport. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await deleteJson(`/api/admin/airports/${airport.id}`);
      toast.success(`Airport "${airport.name}" removed.`);
      onDeleted(airport.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove this airport. Please try again.");
      setConfirmingRemove(false);
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            airport.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {airport.active ? "Active" : "Disabled"}
        </span>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
            {airport.active ? "Disable" : "Enable"}
          </Button>
          {confirmingRemove ? (
            <>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingRemove(false)} disabled={removing}>
                Keep
              </Button>
              <Button type="button" size="sm" onClick={() => void handleRemove()} isLoading={removing}>
                Confirm remove
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingRemove(true)}>
              Remove
            </Button>
          )}
        </div>
      </div>
      <AirportFields form={form} onChange={setForm} errors={errors} disabled={saving} countryOptions={countryOptions} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewAirportForm({
  onCreated,
  countryOptions,
}: {
  onCreated: (airport: AirportData) => void;
  countryOptions: CountryOption[];
}) {
  const [form, setForm] = useState<AirportFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<AirportData>("/api/admin/airports", buildPayload(form));
      toast.success(`Airport "${created.name}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this airport. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.name.trim() && form.code.trim() && form.country.trim() && form.city.trim() && form.countryId;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Airport</h2>
      <AirportFields form={form} onChange={setForm} errors={errors} disabled={creating} countryOptions={countryOptions} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Airport
        </Button>
      </div>
    </div>
  );
}

export function AirportsManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [airports, setAirports] = useState<AirportData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const countryOptions = useCountries();
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<AirportData[]>("/api/admin/airports");
        if (cancelled) return;
        setAirports(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load airports. Please try again.");
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
        title="Couldn't load airports"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const term = search.trim().toLowerCase();
  const filtered = airports.filter((airport) => {
    if (countryFilter && airport.countryId !== countryFilter) return false;
    if (statusFilter === "active" && !airport.active) return false;
    if (statusFilter === "disabled" && airport.active) return false;
    if (!term) return true;
    return [airport.name, airport.code, airport.city, airport.country].some((value) => value.toLowerCase().includes(term));
  });
  const visible = filtered.slice(0, MAX_VISIBLE_AIRPORTS);

  return (
    <div className="flex flex-col gap-4">
      {airports.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TextField
            label="Search"
            name="airport-search"
            placeholder="Name, code, city or country"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <FormField label="Country" htmlFor="airport-country-filter">
            <select
              id="airport-country-filter"
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
              className={cn(fieldControlClass, fieldBorderClass(false))}
            >
              <option value="">All countries</option>
              {countryOptions.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status" htmlFor="airport-status-filter">
            <select
              id="airport-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "disabled")}
              className={cn(fieldControlClass, fieldBorderClass(false))}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </FormField>
        </div>
      ) : null}
      {airports.length === 0 ? (
        <EmptyState title="No airports yet" description="Add the first one using the form below, or bulk-import a CSV above." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No airports match" description="Try a different search or filter." />
      ) : (
        <>
          <p className="text-xs text-ink-tertiary">
            Showing {visible.length} of {filtered.length} airport{filtered.length === 1 ? "" : "s"}
            {filtered.length > visible.length ? " — narrow the search to see the rest." : "."}
          </p>
          {visible.map((airport) => (
            <AirportCard
              key={airport.id}
              airport={airport}
              onSaved={(updated) => setAirports((current) => current.map((a) => (a.id === updated.id ? updated : a)))}
              onDeleted={(id) => setAirports((current) => current.filter((a) => a.id !== id))}
              countryOptions={countryOptions}
            />
          ))}
        </>
      )}
      <NewAirportForm onCreated={(created) => setAirports((current) => [...current, created])} countryOptions={countryOptions} />
    </div>
  );
}
