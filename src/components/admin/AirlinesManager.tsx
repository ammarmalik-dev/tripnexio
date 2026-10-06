"use client";

import { useEffect, useMemo, useState } from "react";
import { MasterTable } from "./MasterTable";
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
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

interface AirlineData {
  id: string;
  name: string;
  code: string;
  country: string;
  otbRequired: boolean;
  normalPrice: string | null;
  urgentPrice: string | null;
  standardProcessingDays: number | null;
  urgentProcessingHours: number | null;
  logoUrl: string | null;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";
type StatusFilter = "all" | "active" | "disabled";

interface AirlineFormState {
  name: string;
  code: string;
  country: string;
  otbRequired: boolean;
  normalPrice: string;
  urgentPrice: string;
  standardProcessingDays: string;
  urgentProcessingHours: string;
  logoUrl: string;
  displayOrder: string;
}

const EMPTY_FORM: AirlineFormState = {
  name: "",
  code: "",
  country: "",
  otbRequired: false,
  normalPrice: "",
  urgentPrice: "",
  standardProcessingDays: "",
  urgentProcessingHours: "",
  logoUrl: "",
  displayOrder: "0",
};

function toFormState(airline: AirlineData): AirlineFormState {
  return {
    name: airline.name,
    code: airline.code,
    country: airline.country,
    otbRequired: airline.otbRequired,
    normalPrice: airline.normalPrice ?? "",
    urgentPrice: airline.urgentPrice ?? "",
    standardProcessingDays: airline.standardProcessingDays === null ? "" : String(airline.standardProcessingDays),
    urgentProcessingHours: airline.urgentProcessingHours === null ? "" : String(airline.urgentProcessingHours),
    logoUrl: airline.logoUrl ?? "",
    displayOrder: String(airline.displayOrder),
  };
}

function AirlineFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: AirlineFormState;
  onChange: (next: AirlineFormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
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
        placeholder="e.g. EK"
        value={form.code}
        onChange={(event) => onChange({ ...form, code: event.target.value.toUpperCase() })}
        error={errors.code?.[0]}
        disabled={disabled}
        maxLength={3}
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
        label="Display Order"
        name="displayOrder"
        type="number"
        value={form.displayOrder}
        onChange={(event) => onChange({ ...form, displayOrder: event.target.value })}
        error={errors.displayOrder?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Normal Processing Price (₹)"
        name="normalPrice"
        type="number"
        step="0.01"
        placeholder="Optional"
        value={form.normalPrice}
        onChange={(event) => onChange({ ...form, normalPrice: event.target.value })}
        error={errors.normalPrice?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Urgent Processing Price (₹)"
        name="urgentPrice"
        type="number"
        step="0.01"
        placeholder="Optional"
        value={form.urgentPrice}
        onChange={(event) => onChange({ ...form, urgentPrice: event.target.value })}
        error={errors.urgentPrice?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Standard OTB processing (working days)"
        name="standardProcessingDays"
        type="number"
        min={1}
        placeholder="Uses the default"
        hint="Optional — overrides Admin → OTB Timelines for this airline."
        value={form.standardProcessingDays}
        onChange={(event) => onChange({ ...form, standardProcessingDays: event.target.value })}
        error={errors.standardProcessingDays?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Urgent OTB processing (working hours)"
        name="urgentProcessingHours"
        type="number"
        min={0}
        placeholder="Uses the default"
        hint="Optional — overrides the default for this airline."
        value={form.urgentProcessingHours}
        onChange={(event) => onChange({ ...form, urgentProcessingHours: event.target.value })}
        error={errors.urgentProcessingHours?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Logo URL"
        name="logoUrl"
        placeholder="Auto-filled from the IATA code"
        hint="Leave blank to auto-fill from a free logos-by-code source; paste a URL to override."
        value={form.logoUrl}
        onChange={(event) => onChange({ ...form, logoUrl: event.target.value })}
        error={errors.logoUrl?.[0]}
        disabled={disabled}
      />
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={form.otbRequired}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, otbRequired: event.target.checked })}
        />
        OTB (Ok to Board) required for this airline
      </label>
    </div>
  );
}

function buildPayload(form: AirlineFormState) {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    country: form.country.trim(),
    otbRequired: form.otbRequired,
    normalPrice: form.normalPrice.trim() === "" ? undefined : Number(form.normalPrice),
    urgentPrice: form.urgentPrice.trim() === "" ? undefined : Number(form.urgentPrice),
    standardProcessingDays: form.standardProcessingDays.trim() === "" ? null : Number(form.standardProcessingDays),
    urgentProcessingHours: form.urgentProcessingHours.trim() === "" ? null : Number(form.urgentProcessingHours),
    logoUrl: form.logoUrl.trim() === "" ? undefined : form.logoUrl.trim(),
    displayOrder: Number(form.displayOrder) || 0,
  };
}

function AirlineCard({ airline, onSaved }: { airline: AirlineData; onSaved: (airline: AirlineData) => void }) {
  const [form, setForm] = useState<AirlineFormState>(toFormState(airline));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(airline));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<AirlineData>(`/api/admin/airlines/${airline.id}`, buildPayload(form));
      toast.success(`Airline "${updated.name}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this airline. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<AirlineData>(`/api/admin/airlines/${airline.id}`, { active: !airline.active });
      toast.success(updated.active ? `${updated.name} enabled.` : `${updated.name} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this airline. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline pb-4">
        <div className="flex min-w-0 items-start gap-3">
          {airline.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external, unpredictable-domain logo URL; next/image would need every possible host allow-listed.
            <img
              src={airline.logoUrl}
              alt={`${airline.name} logo`}
              className="h-9 w-9 shrink-0 rounded-md object-contain"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-ink-heading">{airline.name}</h3>
              <span className="rounded-md bg-ink-primary/[0.05] px-1.5 py-0.5 font-mono text-xs text-ink-secondary">
                {airline.code}
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  airline.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
                )}
              >
                {airline.active ? "Active" : "Disabled"}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-tertiary">
              {[airline.country, airline.otbRequired ? "OTB required" : "No OTB", `Order ${airline.displayOrder}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {airline.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <AirlineFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewAirlineForm({ onCreated }: { onCreated: (airline: AirlineData) => void }) {
  const [form, setForm] = useState<AirlineFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<AirlineData>("/api/admin/airlines", buildPayload(form));
      toast.success(`Airline "${created.name}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this airline. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.name.trim() && form.code.trim() && form.country.trim();

  return (
    <div className="flex flex-col gap-4">
      <AirlineFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Airline
        </Button>
      </div>
    </div>
  );
}

export function AirlinesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [airlines, setAirlines] = useState<AirlineData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return airlines.filter((airline) => {
      if (statusFilter === "active" && !airline.active) return false;
      if (statusFilter === "disabled" && airline.active) return false;
      if (!term) return true;
      return [airline.name, airline.code, airline.country].some((value) => value.toLowerCase().includes(term));
    });
  }, [airlines, search, statusFilter]);
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<AirlineData[]>("/api/admin/airlines");
        if (cancelled) return;
        setAirlines(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load airlines. Please try again.");
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
        title="Couldn't load airlines"
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
  const createOpen = showCreate || airlines.length === 0;
  const trimmedSearch = search.trim();

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-hairline bg-surface-1">
        <button
          type="button"
          onClick={() => setShowCreate((current) => !current)}
          aria-expanded={createOpen}
          aria-controls="new-airline-panel"
          className="flex w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
            <Plus className="h-4 w-4 text-accent-on-light" aria-hidden="true" />
            Add new airline
          </span>
          <ChevronDown
            className={cn("h-4 w-4 text-ink-tertiary transition-transform duration-200", createOpen && "rotate-180")}
            aria-hidden="true"
          />
        </button>
        {createOpen ? (
          <div id="new-airline-panel" className="border-t border-hairline p-5">
            <NewAirlineForm
              onCreated={(created) => {
                setAirlines((current) => [created, ...current]);
                clearFilters();
              }}
            />
          </div>
        ) : null}
      </section>

      {airlines.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1/70 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search airlines"
              placeholder="Search name, code or country"
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
            {filtered.length} airline{filtered.length === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      {airlines.length === 0 ? (
        <EmptyState title="No airlines yet" description="Add the first one using the form above." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={trimmedSearch ? `No airlines match "${trimmedSearch}"` : "No airlines match these filters"}
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
            {
              header: "Airline",
              cell: (row) => (
                <span className="inline-flex items-center gap-3">
                  {row.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Admin-set logo URL (any host)
                    <img src={row.logoUrl} alt="" className="h-8 w-8 rounded-md bg-white object-contain p-0.5 ring-1 ring-hairline" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-warning/10 text-[10px] font-semibold text-warning" title="Logo missing">
                      {row.code}
                    </span>
                  )}
                  <span className="font-medium text-ink-primary">{row.name}</span>
                </span>
              ),
            },
            { header: "Code", cell: (row) => <span className="font-mono text-xs">{row.code}</span> },
            { header: "Country", cell: (row) => row.country },
            { header: "Logo", cell: (row) => (row.logoUrl ? "Set" : <span className="font-medium text-warning">Missing</span>) },
          ]}
          renderEditor={(row) => (
            <AirlineCard
              airline={row}
              onSaved={(updated) => setAirlines((current) => current.map((a) => (a.id === updated.id ? updated : a)))}
            />
          )}
        />
      )}

      <ListPagination noun="airline" {...paginationProps} />
    </div>
  );
}
