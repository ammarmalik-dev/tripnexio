"use client";

import { useEffect, useMemo, useState } from "react";
import { MasterTable } from "./MasterTable";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

interface CountryOption {
  id: string;
  name: string;
}

interface VisaTypeData {
  id: string;
  name: string;
  countryId: string | null;
  country: CountryOption | null;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";
type StatusFilter = "all" | "active" | "hidden";

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
    <FormField label="Destination country" htmlFor={id} error={error}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={cn(fieldControlClass, fieldBorderClass(!!error))}
      >
        <option value="">All countries</option>
        {countries.map((country) => (
          <option key={country.id} value={country.id}>
            {country.name}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function VisaTypeRow({
  visaType,
  countries,
  onSaved,
  onDeleted,
}: {
  visaType: VisaTypeData;
  countries: CountryOption[];
  onSaved: (v: VisaTypeData) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(visaType.name);
  const [countryId, setCountryId] = useState(visaType.countryId ?? "");
  const [order, setOrder] = useState(String(visaType.displayOrder));
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const dirty =
    name.trim() !== visaType.name ||
    (countryId || null) !== visaType.countryId ||
    (Number(order) || 0) !== visaType.displayOrder;

  const save = async (patch: { name?: string; countryId?: string | null; displayOrder?: number; active?: boolean }) => {
    setBusy(true);
    setError(undefined);
    try {
      const updated = await patchJson<VisaTypeData>(`/api/admin/visa-types/${visaType.id}`, patch);
      toast.success(`"${updated.name}" updated.`);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.name) setError(err.fieldErrors.name[0]);
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this visa type. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const reason = await confirm({
      title: `Remove visa type "${visaType.name}"?`,
      description: "This permanently deletes the visa type. To stop offering it without deleting, hide it instead.",
      confirmLabel: "Remove Visa Type",
    });
    if (!reason) return;
    setBusy(true);
    try {
      await deleteJson(withReasonQuery(`/api/admin/visa-types/${visaType.id}`, reason));
      toast.success(`"${visaType.name}" removed.`);
      onDeleted(visaType.id);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't remove this visa type. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-ink-heading">{visaType.name}</h3>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                visaType.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
              )}
            >
              {visaType.active ? "Active" : "Hidden"}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-tertiary">
            {visaType.country?.name ?? "All countries"} · Order {visaType.displayOrder}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => void save({ active: !visaType.active })} disabled={busy}>
            {visaType.active ? "Hide" : "Show"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void remove()} disabled={busy}>
            Remove
          </Button>
          {dialog}
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_100px]">
          <TextField label="Visa type" name={`name-${visaType.id}`} value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={busy} />
          <CountrySelect id={`country-${visaType.id}`} value={countryId} countries={countries} onChange={setCountryId} disabled={busy} />
          <TextField label="Order" name={`order-${visaType.id}`} type="number" value={order} onChange={(e) => setOrder(e.target.value)} disabled={busy} />
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => void save({ name: name.trim(), countryId: countryId || null, displayOrder: Number(order) || 0 })}
            disabled={!dirty || busy}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function NewVisaTypeForm({ countries, onCreated }: { countries: CountryOption[]; onCreated: (v: VisaTypeData) => void }) {
  const [name, setName] = useState("");
  const [countryId, setCountryId] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    setError(undefined);
    try {
      const created = await postJson<VisaTypeData>("/api/admin/visa-types", { name: name.trim(), countryId: countryId || null });
      toast.success(`"${created.name}" added.`);
      onCreated(created);
      setName("");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors?.name) setError(err.fieldErrors.name[0]);
      toast.error(err instanceof ApiError ? err.message : "Couldn't add this visa type. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="New visa type" name="new-visa-type" value={name} onChange={(e) => setName(e.target.value)} error={error} disabled={creating} />
        <CountrySelect id="new-visa-type-country" value={countryId} countries={countries} onChange={setCountryId} disabled={creating} />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void create()} isLoading={creating} disabled={name.trim().length < 2}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Visa Type
        </Button>
      </div>
    </div>
  );
}

export function VisaTypesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<VisaTypeData[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (countryFilter && item.countryId !== countryFilter) return false;
      if (statusFilter === "active" && !item.active) return false;
      if (statusFilter === "hidden" && item.active) return false;
      if (!term) return true;
      return [item.name, item.country?.name ?? ""].some((value) => value.toLowerCase().includes(term));
    });
  }, [items, search, countryFilter, statusFilter]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const [visaTypes, countryRows] = await Promise.all([
          getJson<VisaTypeData[]>("/api/admin/visa-types"),
          getJson<CountryOption[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setItems(visaTypes);
        setCountries(countryRows.map((country) => ({ id: country.id, name: country.name })));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load visa types. Please try again.");
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
        title="Couldn't load visa types"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
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
  const createOpen = showCreate || items.length === 0;
  const trimmedSearch = search.trim();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-hairline bg-surface-1">
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          aria-expanded={createOpen}
          aria-controls="new-visa-type-panel"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plus className="h-4 w-4 text-accent-on-light" aria-hidden="true" />
            Add new visa type
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-ink-tertiary transition-transform duration-200", createOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {createOpen ? (
          <div id="new-visa-type-panel" className="border-t border-hairline p-5">
            <NewVisaTypeForm
              countries={countries}
              onCreated={(created) => {
                setItems((current) => [created, ...current]);
                clearFilters();
              }}
            />
          </div>
        ) : null}
      </section>

      {items.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search visa types"
              placeholder="Search visa type or country"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-10 pl-9")}
            />
          </div>
          <select
            aria-label="Filter by destination country"
            value={countryFilter}
            onChange={(event) => {
              setCountryFilter(event.target.value);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-48")}
          >
            <option value="">All countries</option>
            {countries.map((country) => (
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
            <option value="hidden">Hidden</option>
          </select>
          <p className="shrink-0 text-xs font-medium text-ink-tertiary sm:px-2" aria-live="polite">
            {filtered.length} visa type{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="No visa types yet"
          description="Until one is added, the New Visa form skips the Visa Type question and your team confirms it with the customer."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trimmedSearch ? `No visa types match "${trimmedSearch}"` : "No visa types match these filters"}
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
          minWidth={640}
          columns={[
            { header: "Visa Type", cell: (row) => <span className="font-medium text-ink-primary">{row.name}</span> },
            { header: "Country", cell: (row) => row.country?.name ?? "All countries" },
            { header: "Order", cell: (row) => row.displayOrder },
          ]}
          renderEditor={(row) => (
            <VisaTypeRow
              visaType={row}
              countries={countries}
              onSaved={(updated) => setItems((current) => current.map((v) => (v.id === updated.id ? updated : v)))}
              onDeleted={(id) => setItems((current) => current.filter((v) => v.id !== id))}
            />
          )}
        />
      )}

      <ListPagination noun="visa type" {...paginationProps} />
    </div>
  );
}
