"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

type HolidayCountry = "INDIA" | "UAE";
type StatusFilter = "all" | "active" | "disabled";

interface HolidayData {
  id: string;
  date: string;
  country: HolidayCountry;
  name: string;
  active: boolean;
}

const COUNTRY_LABELS: Record<HolidayCountry, string> = { INDIA: "India", UAE: "UAE" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function HolidayRow({ holiday, onSaved }: { holiday: HolidayData; onSaved: (h: HolidayData) => void }) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const updated = await patchJson<HolidayData>(`/api/admin/holidays/${holiday.id}`, { active: !holiday.active });
      toast.success(`"${updated.name}" ${updated.active ? "enabled" : "disabled"}.`);
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this holiday. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline bg-surface-1 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink-heading">{holiday.name}</h3>
          <span className="rounded-md bg-ink-primary/[0.05] px-1.5 py-0.5 text-xs font-medium text-ink-secondary">
            {COUNTRY_LABELS[holiday.country]}
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              holiday.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
            )}
          >
            {holiday.active ? "Active" : "Disabled"}
          </span>
        </div>
        <p className="mt-1 text-xs text-ink-tertiary">{formatDate(holiday.date)}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" size="sm" variant="ghost" onClick={() => void toggle()} isLoading={busy}>
          {holiday.active ? "Disable" : "Enable"}
        </Button>
      </div>
    </div>
  );
}

function NewHolidayForm({ onCreated }: { onCreated: (h: HolidayData) => void }) {
  const [date, setDate] = useState("");
  const [country, setCountry] = useState<HolidayCountry>("INDIA");
  const [name, setName] = useState("");
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const create = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<HolidayData>("/api/admin/holidays", { date, country, name: name.trim() });
      toast.success(`"${created.name}" added.`);
      onCreated(created);
      setName("");
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : "Couldn't add this holiday. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Date" name="holiday-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors.date?.[0]} disabled={creating} />
        <FormField label="Country" htmlFor="holiday-country" error={errors.country?.[0]}>
          <select
            id="holiday-country"
            value={country}
            disabled={creating}
            onChange={(e) => setCountry(e.target.value as HolidayCountry)}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.country))}
          >
            <option value="INDIA">India</option>
            <option value="UAE">UAE</option>
          </select>
        </FormField>
        <TextField label="Holiday name" name="holiday-name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name?.[0]} disabled={creating} />
      </div>
      <Button type="button" size="sm" onClick={() => void create()} isLoading={creating} disabled={!date || name.trim().length < 2}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add
      </Button>
    </div>
  );
}

export function HolidaysManager() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [items, setItems] = useState<HolidayData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<HolidayCountry | "">("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((holiday) => {
      if (countryFilter && holiday.country !== countryFilter) return false;
      if (statusFilter === "active" && !holiday.active) return false;
      if (statusFilter === "disabled" && holiday.active) return false;
      if (!term) return true;
      return [holiday.name, COUNTRY_LABELS[holiday.country], formatDate(holiday.date)].some((value) =>
        value.toLowerCase().includes(term)
      );
    });
  }, [items, search, countryFilter, statusFilter]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<HolidayData[]>(`/api/admin/holidays?year=${year}`);
        if (cancelled) return;
        setItems(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load holidays. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [year, reloadNonce]);

  const clearFilters = () => {
    setSearch("");
    setCountryFilter("");
    setStatusFilter("all");
    resetPage();
  };
  const changeYear = (delta: number) => {
    setYear((y) => y + delta);
    resetPage();
  };
  const createOpen = showCreate || (state === "success" && items.length === 0);
  const trimmedSearch = search.trim();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-hairline bg-surface-1">
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          aria-expanded={createOpen}
          aria-controls="new-holiday-panel"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plus className="h-4 w-4 text-accent-on-light" aria-hidden="true" />
            Add new holiday
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-ink-tertiary transition-transform duration-200", createOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {createOpen ? (
          <div id="new-holiday-panel" className="border-t border-hairline p-5">
            <NewHolidayForm
              onCreated={(created) => {
                if (new Date(created.date).getUTCFullYear() === year) {
                  setItems((current) => [created, ...current]);
                  clearFilters();
                }
              }}
            />
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={() => changeYear(-1)} aria-label="Previous year" className="px-2">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="min-w-12 text-center text-sm font-semibold text-ink-heading" aria-live="polite">
            {year}
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={() => changeYear(1)} aria-label="Next year" className="px-2">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            aria-label="Search holidays"
            placeholder="Search holiday name or date"
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
            setCountryFilter(event.target.value as HolidayCountry | "");
            resetPage();
          }}
          className={cn(fieldControlClass, fieldBorderClass(false), "h-10 sm:w-40")}
        >
          <option value="">All countries</option>
          <option value="INDIA">India</option>
          <option value="UAE">UAE</option>
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
        {state === "success" ? (
          <p className="shrink-0 text-xs font-medium text-ink-tertiary sm:px-2" aria-live="polite">
            {filtered.length} holiday{filtered.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : state === "error" ? (
        <ErrorState
          title="Couldn't load holidays"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState title={`No holidays for ${year}`} description="Add each public holiday using the form above — nothing is pre-filled." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trimmedSearch ? `No holidays match "${trimmedSearch}"` : "No holidays match these filters"}
          description="Try a different search or filter."
          action={
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {pageItems.map((item) => (
            <HolidayRow
              key={item.id}
              holiday={item}
              onSaved={(updated) => setItems((current) => current.map((h) => (h.id === updated.id ? updated : h)))}
            />
          ))}
        </div>
      )}

      {state === "success" ? <ListPagination noun="holiday" {...paginationProps} /> : null}
    </div>
  );
}
