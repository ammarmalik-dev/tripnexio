"use client";

import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";

interface DestinationData {
  id: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  ratePerApplicant: number;
  cancellationFee: number | null;
  airlineFeePerApplicant: number;
  active: boolean;
  displayOrder: number;
}

interface CountryData {
  id: string;
  name: string;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";
type FieldErrors = Record<string, string[] | undefined>;
type ActiveFilter = "all" | "active" | "inactive";

interface FormState {
  rate: string;
  airlineFee: string;
  cancellationFee: string;
  displayOrder: string;
}

function toFormState(d: DestinationData): FormState {
  return {
    rate: String(d.ratePerApplicant),
    airlineFee: String(d.airlineFeePerApplicant ?? 0),
    cancellationFee: d.cancellationFee === null ? "" : String(d.cancellationFee),
    displayOrder: String(d.displayOrder),
  };
}

function toPayload(form: FormState) {
  return {
    ratePerApplicant: Number(form.rate),
    airlineFeePerApplicant: form.airlineFee.trim() === "" ? 0 : Number(form.airlineFee),
    cancellationFee: form.cancellationFee.trim() === "" ? null : Number(form.cancellationFee),
    displayOrder: Number(form.displayOrder) || 0,
  };
}

function RateFields({
  idPrefix,
  form,
  onChange,
  errors,
  disabled,
}: {
  /** Keeps control ids unique when several cards are on screen at once. */
  idPrefix: string;
  form: FormState;
  onChange: (next: FormState) => void;
  errors: FieldErrors;
  disabled: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
      <TextField
        label="Rate per applicant (₹)"
        name={`${idPrefix}-rate`}
        type="number"
        min={0}
        value={form.rate}
        onChange={(event) => onChange({ ...form, rate: event.target.value })}
        error={errors.ratePerApplicant?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Airline fee inside rate (₹)"
        name={`${idPrefix}-airlineFee`}
        type="number"
        min={0}
        hint="Shown apart on the invoice, no GST."
        value={form.airlineFee}
        onChange={(event) => onChange({ ...form, airlineFee: event.target.value })}
        error={errors.airlineFeePerApplicant?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Cancellation fee per booking (₹)"
        name={`${idPrefix}-cancellationFee`}
        type="number"
        min={0}
        placeholder="Not set"
        hint="Shown before payment; deducted on cancellation before forwarding."
        value={form.cancellationFee}
        onChange={(event) => onChange({ ...form, cancellationFee: event.target.value })}
        error={errors.cancellationFee?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Display Order"
        name={`${idPrefix}-displayOrder`}
        type="number"
        value={form.displayOrder}
        onChange={(event) => onChange({ ...form, displayOrder: event.target.value })}
        error={errors.displayOrder?.[0]}
        disabled={disabled}
      />
    </div>
  );
}

function DestinationCard({ destination, onSaved }: { destination: DestinationData; onSaved: (d: DestinationData) => void }) {
  const { confirm, dialog } = useConfirmAction();
  const [form, setForm] = useState<FormState>(toFormState(destination));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(destination));

  const handleSave = async () => {
    const reason = await confirm({
      title: `Change Return Ticket rate for ${destination.countryName}?`,
      description: "This changes the per-applicant rate/cancellation fee customers are charged for this destination.",
      confirmLabel: "Save Rate",
    });
    if (!reason) return;
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<DestinationData>(
        `/api/admin/return-ticket-destinations/${destination.id}`,
        { ...toPayload(form), reason }
      );
      toast.success(`${updated.countryName} updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this destination. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    const reason = await confirm({
      title: `${destination.active ? "Disable" : "Enable"} ${destination.countryName}?`,
      description: destination.active ? "Customers will no longer be able to request a Return Ticket for this destination." : "Customers will be able to request a Return Ticket for this destination again.",
      confirmLabel: destination.active ? "Disable" : "Enable",
    });
    if (!reason) return;
    setToggling(true);
    try {
      const updated = await patchJson<DestinationData>(`/api/admin/return-ticket-destinations/${destination.id}`, {
        active: !destination.active,
        reason,
      });
      toast.success(updated.active ? `${updated.countryName} enabled.` : `${updated.countryName} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this destination. Please try again.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-heading">
            {destination.countryName} <span className="text-xs font-normal text-ink-tertiary">({destination.countryCode})</span>
          </span>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              destination.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
            )}
          >
            {destination.active ? "Active" : "Disabled"}
          </span>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggle()} isLoading={toggling}>
          {destination.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <RateFields idPrefix={`destination-${destination.id}`} form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
      {dialog}
    </div>
  );
}

function NewDestinationForm({
  availableCountries,
  onCreated,
  defaultCountryId,
}: {
  availableCountries: CountryData[];
  onCreated: (d: DestinationData) => void;
  defaultCountryId?: string;
}) {
  const { confirm, dialog } = useConfirmAction();
  const [countryId, setCountryId] = useState(defaultCountryId ?? "");
  const [form, setForm] = useState<FormState>({ rate: "", airlineFee: "", cancellationFee: "", displayOrder: "0" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const reason = await confirm({
      title: "Add Return Ticket destination?",
      description: `This sets a rate of ₹${form.rate || "?"} per applicant for the selected country.`,
      confirmLabel: "Add Destination",
    });
    if (!reason) return;
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<DestinationData>("/api/admin/return-ticket-destinations", {
        countryId,
        ...toPayload(form),
        reason,
      });
      toast.success(`${created.countryName} added.`);
      onCreated(created);
      setCountryId("");
      setForm({ rate: "", airlineFee: "", cancellationFee: "", displayOrder: "0" });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this destination. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Add Destination</h2>
      <SelectField
        label="Country"
        name="new-destination-countryId"
        placeholder={availableCountries.length ? "Select a country" : "All countries already added"}
        options={availableCountries.map((c) => ({ value: c.id, label: c.name }))}
        value={countryId}
        onChange={(event) => setCountryId(event.target.value)}
        error={errors.countryId?.[0]}
        disabled={creating || availableCountries.length === 0}
      />
      <RateFields idPrefix="new-destination" form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => void handleCreate()}
          isLoading={creating}
          disabled={!countryId || form.rate === ""}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Destination
        </Button>
      </div>
      {dialog}
    </div>
  );
}

/**
 * P23 — optional `countryId` (Service Configuration hub) narrows the list to
 * that country's destination and pre-selects it on the add form when it isn't
 * set up yet. Absent = every destination, as before.
 */
export function ReturnTicketDestinationsManager({ countryId }: { countryId?: string } = {}) {
  const [state, setState] = useState<FetchState>("loading");
  const [destinations, setDestinations] = useState<DestinationData[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const visibleDestinations = countryId ? destinations.filter((d) => d.countryId === countryId) : destinations;
  const query = search.trim().toLowerCase();
  const filtered = visibleDestinations.filter((destination) => {
    if (activeFilter === "active" && !destination.active) return false;
    if (activeFilter === "inactive" && destination.active) return false;
    return !query || `${destination.countryName} ${destination.countryCode}`.toLowerCase().includes(query);
  });
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);
  const hasFilters = query !== "" || activeFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setActiveFilter("all");
    resetPage();
  };

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [destinationList, countryList] = await Promise.all([
          getJson<DestinationData[]>("/api/admin/return-ticket-destinations"),
          getJson<CountryData[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setDestinations(destinationList);
        setCountries(countryList);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load destinations. Please try again.");
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
        title="Couldn't load destinations"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const usedCountryIds = new Set(destinations.map((d) => d.countryId));
  const availableCountries = countries.filter((c) => c.active && !usedCountryIds.has(c.id));

  const defaultCountryId = countryId && availableCountries.some((c) => c.id === countryId) ? countryId : undefined;

  return (
    <div className="flex flex-col gap-4">
      {visibleDestinations.length === 0 ? (
        <EmptyState
          title={countryId ? "This country isn't a Return Ticket destination yet" : "No destinations yet"}
          description="Add the first destination using the form below."
        />
      ) : (
        <>
          {countryId ? null : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
                <label htmlFor="return-ticket-destination-search" className="sr-only">
                  Search destinations
                </label>
                <input
                  id="return-ticket-destination-search"
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetPage();
                  }}
                  placeholder="Search by country name or code…"
                  className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
                />
              </div>
              <label htmlFor="return-ticket-destination-filter-active" className="sr-only">
                Filter by status
              </label>
              <select
                id="return-ticket-destination-filter-active"
                value={activeFilter}
                onChange={(event) => {
                  setActiveFilter(event.target.value as ActiveFilter);
                  resetPage();
                }}
                className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[130px]")}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Disabled</option>
              </select>
              {hasFilters ? (
                <Button type="button" variant="ghost" size="md" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          )}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" aria-hidden="true" />}
              title="No destinations match these filters"
              description={`None of the ${visibleDestinations.length} destinations match. Try a different search term or clear the filters.`}
              action={
                <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              {pageItems.map((destination) => (
                <DestinationCard
                  key={destination.id}
                  destination={destination}
                  onSaved={(updated) => setDestinations((current) => current.map((d) => (d.id === updated.id ? updated : d)))}
                />
              ))}
              <ListPagination noun="destination" {...paginationProps} />
            </>
          )}
        </>
      )}
      <NewDestinationForm
        key={`${defaultCountryId ?? ""}-${destinations.length}`}
        defaultCountryId={defaultCountryId}
        availableCountries={availableCountries}
        onCreated={(created) => setDestinations((current) => [...current, created])}
      />
    </div>
  );
}
