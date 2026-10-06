"use client";

import { useEffect, useMemo, useState } from "react";
import { MasterTable } from "./MasterTable";
import { FlagBadge } from "./FlagBadge";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { useCountries, type CountryOption } from "@/lib/admin/use-countries";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

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
type StatusFilter = "all" | "active" | "disabled";

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
      <FormField label="Country Classification" htmlFor="countryId" error={errors.countryId?.[0]}>
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
  const { confirm, dialog } = useConfirmAction();
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
    const reason = await confirm({
      title: `Remove airport "${airport.name}"?`,
      description: "This permanently deletes the airport record. If it's still referenced elsewhere the removal will be refused — disable it instead.",
      confirmLabel: "Remove Airport",
    });
    if (!reason) return;
    setRemoving(true);
    try {
      await deleteJson(withReasonQuery(`/api/admin/airports/${airport.id}`, reason));
      toast.success(`Airport "${airport.name}" removed.`);
      onDeleted(airport.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove this airport. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink-heading">{airport.name}</h3>
            <span className="rounded-md bg-ink-primary/[0.05] px-1.5 py-0.5 font-mono text-xs text-ink-secondary">
              {airport.code}
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                airport.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
              )}
            >
              {airport.active ? "Active" : "Disabled"}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-tertiary">
            {[airport.city, airport.country, airport.countryRef?.name].filter(Boolean).join(" · ")} · Order{" "}
            {airport.displayOrder}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
            {airport.active ? "Disable" : "Enable"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleRemove()} isLoading={removing}>
            Remove
          </Button>
          {dialog}
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
    <div className="flex flex-col gap-4">
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return airports.filter((airport) => {
      if (countryFilter && airport.countryId !== countryFilter) return false;
      if (statusFilter === "active" && !airport.active) return false;
      if (statusFilter === "disabled" && airport.active) return false;
      if (!term) return true;
      return [airport.name, airport.code, airport.city, airport.country].some((value) => value.toLowerCase().includes(term));
    });
  }, [airports, search, countryFilter, statusFilter]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

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

  const clearFilters = () => {
    setSearch("");
    setCountryFilter("");
    setStatusFilter("all");
    resetPage();
  };
  const createOpen = showCreate || airports.length === 0;
  const trimmedSearch = search.trim();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-hairline bg-surface-1">
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          aria-expanded={createOpen}
          aria-controls="new-airport-panel"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plus className="h-4 w-4 text-accent-on-light" aria-hidden="true" />
            Add new airport
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-ink-tertiary transition-transform duration-200", createOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {createOpen ? (
          <div id="new-airport-panel" className="border-t border-hairline p-5">
            <NewAirportForm
              onCreated={(created) => {
                setAirports((current) => [created, ...current]);
                clearFilters();
              }}
              countryOptions={countryOptions}
            />
          </div>
        ) : null}
      </section>

      {airports.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search airports"
              placeholder="Search name, code, city or country"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-10 pl-9")}
            />
          </div>
          <select
            aria-label="Filter by country"
            value={countryFilter}
            onChange={(event) => {
              setCountryFilter(event.target.value);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-48")}
          >
            <option value="">All countries</option>
            {countryOptions.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
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
            {filtered.length} airport{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      {airports.length === 0 ? (
        <EmptyState title="No airports yet" description="Add the first one using the form above, or bulk-import a CSV." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trimmedSearch ? `No airports match "${trimmedSearch}"` : "No airports match these filters"}
          description="Try a different search or filter."
          action={
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <MasterTable
          rows={pageItems}
          minWidth={820}
          columns={[
            { header: "Code", cell: (row) => <span className="font-mono text-xs font-semibold text-ink-primary">{row.code}</span> },
            { header: "Airport", cell: (row) => <span className="font-medium text-ink-primary">{row.name}</span> },
            { header: "City", cell: (row) => row.city || "—" },
            {
              header: "Country",
              cell: (row) => (
                <span className="inline-flex items-center gap-2">
                  {row.countryRef?.code ? <FlagBadge code={row.countryRef.code} /> : null}
                  {row.countryRef?.name ?? row.country}
                </span>
              ),
            },
          ]}
          renderEditor={(row) => (
            <AirportCard
              airport={row}
              onSaved={(updated) => setAirports((current) => current.map((a) => (a.id === updated.id ? updated : a)))}
              onDeleted={(id) => setAirports((current) => current.filter((a) => a.id !== id))}
              countryOptions={countryOptions}
            />
          )}
        />
      )}

      <ListPagination noun="airport" {...paginationProps} />
    </div>
  );
}
