"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { countryFlag } from "@/lib/countries/flag";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

interface CountryData {
  id: string;
  code: string;
  name: string;
  flagOverride: string | null;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";
type StatusFilter = "all" | "active" | "disabled";

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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <FlagBadge code={country.code} flagOverride={country.flagOverride} className="mt-0.5" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-ink-heading">{country.name}</h3>
              <span className="rounded-md bg-ink-primary/[0.05] px-1.5 py-0.5 font-mono text-xs text-ink-secondary">
                {country.code}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  country.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
                )}
              >
                {country.active ? "Active" : "Disabled"}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-tertiary">
              {country.flagOverride ? "Custom flag" : "Auto flag"} · Order {country.displayOrder}
            </p>
          </div>
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
    <div className="flex flex-col gap-4">
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return countries.filter((country) => {
      if (statusFilter === "active" && !country.active) return false;
      if (statusFilter === "disabled" && country.active) return false;
      if (!term) return true;
      return [country.name, country.code].some((value) => value.toLowerCase().includes(term));
    });
  }, [countries, search, statusFilter]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

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

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    resetPage();
  };
  const createOpen = showCreate || countries.length === 0;
  const trimmedSearch = search.trim();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-hairline bg-surface-1">
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          aria-expanded={createOpen}
          aria-controls="new-country-panel"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plus className="h-4 w-4 text-accent-on-light" aria-hidden="true" />
            Add new country
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-ink-tertiary transition-transform duration-200", createOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {createOpen ? (
          <div id="new-country-panel" className="border-t border-hairline p-5">
            <NewCountryForm
              onCreated={(created) => {
                setCountries((current) => [created, ...current]);
                clearFilters();
              }}
            />
          </div>
        ) : null}
      </section>

      {countries.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search countries"
              placeholder="Search name or code"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-10 pl-9")}
            />
          </div>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-36")}
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
          <p className="shrink-0 text-xs font-medium text-ink-tertiary sm:px-2" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "country" : "countries"}
          </p>
        </div>
      ) : null}

      {countries.length === 0 ? (
        <EmptyState title="No countries yet" description="Add the first one using the form above." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trimmedSearch ? `No countries match "${trimmedSearch}"` : "No countries match these filters"}
          description="Try a different search or filter."
          action={
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pageItems.map((country) => (
            <CountryCard
              key={country.id}
              country={country}
              onSaved={(updated) => setCountries((current) => current.map((a) => (a.id === updated.id ? updated : a)))}
            />
          ))}
        </div>
      )}

      <ListPagination noun="country record" {...paginationProps} />
    </div>
  );
}
