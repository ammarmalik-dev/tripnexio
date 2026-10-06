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

type PaxType = "ADULT" | "CHILD" | "INFANT";
const PAX_LABELS: Record<PaxType, string> = { ADULT: "Adult", CHILD: "Child", INFANT: "Infant" };

interface OtbPriceData {
  id: string;
  airlineId: string;
  airlineName: string;
  airlineCode: string;
  countryId: string;
  countryName: string;
  countryCode: string;
  paxType: PaxType;
  normalPrice: number;
  urgentPrice: number | null;
  airlineFee: number;
  active: boolean;
}

interface Option {
  id: string;
  name: string;
  active: boolean;
  otbRequired?: boolean;
  code?: string;
}

type FieldErrors = Record<string, string[] | undefined>;
type FetchState = "loading" | "success" | "error";
type ActiveFilter = "all" | "active" | "inactive";

const toNumber = (value: string) => (value.trim() === "" ? Number.NaN : Number(value));
const toNullableNumber = (value: string) => (value.trim() === "" ? null : Number(value));

function PriceRow({ row, onSaved }: { row: OtbPriceData; onSaved: (row: OtbPriceData) => void }) {
  const { confirm, dialog } = useConfirmAction();
  const initial = { normal: String(row.normalPrice), urgent: row.urgentPrice === null ? "" : String(row.urgentPrice), fee: String(row.airlineFee) };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const dirty = form.normal !== initial.normal || form.urgent !== initial.urgent || form.fee !== initial.fee;

  const save = async (body: Record<string, unknown>, message: string) => {
    const reason = await confirm({
      title: `Change OTB price for ${row.airlineName} → ${row.countryName}?`,
      description: `${message.replace(/\.$/, "")} — this changes what customers are charged for OTB on this route.`,
      confirmLabel: "Confirm Change",
    });
    if (!reason) return;
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<OtbPriceData>(`/api/admin/otb-prices/${row.id}`, { ...body, reason });
      toast.success(message);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this price.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink-heading">
          {row.airlineName} ({row.airlineCode}) → {row.countryName} · {PAX_LABELS[row.paxType]}
        </span>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", row.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
            {row.active ? "Active" : "Disabled"}
          </span>
          <Button type="button" size="sm" variant="ghost" disabled={saving} onClick={() => void save({ active: !row.active }, row.active ? "Price disabled." : "Price enabled.")}>
            {row.active ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Normal price (₹)" name={`normal-${row.id}`} type="number" min={0} value={form.normal} onChange={(e) => setForm({ ...form, normal: e.target.value })} error={errors.normalPrice?.[0]} disabled={saving} />
        <TextField label="Urgent price (₹)" name={`urgent-${row.id}`} type="number" min={0} placeholder="Airline price" value={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.value })} error={errors.urgentPrice?.[0]} disabled={saving} />
        <TextField label="Airline fee inside price (₹)" name={`fee-${row.id}`} type="number" min={0} value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} error={errors.airlineFee?.[0]} disabled={saving} />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!dirty} isLoading={saving} onClick={() => void save({ normalPrice: toNumber(form.normal), urgentPrice: toNullableNumber(form.urgent), airlineFee: toNullableNumber(form.fee) ?? 0 }, "Price updated.")}>
          Save Changes
        </Button>
      </div>
      {dialog}
    </div>
  );
}

function NewPriceForm({
  airlines,
  countries,
  onCreated,
  defaultCountryId,
}: {
  airlines: Option[];
  countries: Option[];
  onCreated: (row: OtbPriceData) => void;
  defaultCountryId?: string;
}) {
  const { confirm, dialog } = useConfirmAction();
  const empty = { airlineId: "", countryId: defaultCountryId ?? "", paxType: "ADULT", normal: "", urgent: "", fee: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const reason = await confirm({
      title: "Add OTB price?",
      description: "This sets a new OTB price customers will be charged for this airline, destination and passenger type.",
      confirmLabel: "Add Price",
    });
    if (!reason) return;
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<OtbPriceData>("/api/admin/otb-prices", {
        airlineId: form.airlineId,
        countryId: form.countryId,
        paxType: form.paxType,
        normalPrice: toNumber(form.normal),
        urgentPrice: toNullableNumber(form.urgent),
        airlineFee: toNullableNumber(form.fee) ?? 0,
        reason,
      });
      toast.success("OTB price added.");
      onCreated(created);
      setForm(empty);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this price.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Add OTB price</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SelectField label="Airline" name="otb-price-airline" placeholder="Select an airline" options={airlines.map((a) => ({ value: a.id, label: `${a.name} (${a.code ?? ""})` }))} value={form.airlineId} onChange={(e) => setForm({ ...form, airlineId: e.target.value })} error={errors.airlineId?.[0]} disabled={creating} />
        <SelectField label="Destination country" name="otb-price-country" placeholder="Select a country" options={countries.map((c) => ({ value: c.id, label: c.name }))} value={form.countryId} onChange={(e) => setForm({ ...form, countryId: e.target.value })} error={errors.countryId?.[0]} disabled={creating} />
        <SelectField label="Passenger type" name="otb-price-pax" options={(Object.keys(PAX_LABELS) as PaxType[]).map((p) => ({ value: p, label: PAX_LABELS[p] }))} value={form.paxType} onChange={(e) => setForm({ ...form, paxType: e.target.value })} error={errors.paxType?.[0]} disabled={creating} />
        <TextField label="Normal price (₹)" name="otb-price-normal" type="number" min={0} value={form.normal} onChange={(e) => setForm({ ...form, normal: e.target.value })} error={errors.normalPrice?.[0]} disabled={creating} />
        <TextField label="Urgent price (₹)" name="otb-price-urgent" type="number" min={0} placeholder="Airline price" value={form.urgent} onChange={(e) => setForm({ ...form, urgent: e.target.value })} error={errors.urgentPrice?.[0]} disabled={creating} />
        <TextField label="Airline fee inside price (₹)" name="otb-price-fee" type="number" min={0} placeholder="0" hint="Shown apart on the invoice, no GST." value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} error={errors.airlineFee?.[0]} disabled={creating} />
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" isLoading={creating} disabled={!form.airlineId || !form.countryId || form.normal === ""} onClick={() => void create()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add price
        </Button>
      </div>
      {dialog}
    </div>
  );
}

/**
 * P18 — Admin OTB pricing by airline + destination country + passenger
 * type (Developer Answers §4). Where no active row matches, the airline's
 * own normal/urgent price (Admin → Airlines) is charged.
 */
export function OtbPricesManager({ countryId }: { countryId?: string } = {}) {
  const [state, setState] = useState<FetchState>("loading");
  const [rows, setRows] = useState<OtbPriceData[]>([]);
  const [airlines, setAirlines] = useState<Option[]>([]);
  const [countries, setCountries] = useState<Option[]>([]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [airlineFilter, setAirlineFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [paxFilter, setPaxFilter] = useState<PaxType | "">("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  // P23 — optional `countryId` (Service Configuration hub) narrows the list and pre-fills the add form. Absent = every row.
  const visibleRows = countryId ? rows.filter((row) => row.countryId === countryId) : rows;
  const query = search.trim().toLowerCase();
  const filtered = visibleRows.filter((row) => {
    if (airlineFilter && row.airlineId !== airlineFilter) return false;
    if (countryFilter && row.countryId !== countryFilter) return false;
    if (paxFilter && row.paxType !== paxFilter) return false;
    if (activeFilter === "active" && !row.active) return false;
    if (activeFilter === "inactive" && row.active) return false;
    if (!query) return true;
    return [row.airlineName, row.airlineCode, row.countryName, row.countryCode].join(" ").toLowerCase().includes(query);
  });
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);
  const hasFilters = query !== "" || airlineFilter !== "" || countryFilter !== "" || paxFilter !== "" || activeFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setAirlineFilter("");
    setCountryFilter("");
    setPaxFilter("");
    setActiveFilter("all");
    resetPage();
  };
  // Filter options come from the price rows themselves, so an airline/country that has since been deactivated is still filterable.
  const airlineOptions = [...new Map(visibleRows.map((row) => [row.airlineId, `${row.airlineName} (${row.airlineCode})`])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1]),
  );
  const countryOptions = [...new Map(visibleRows.map((row) => [row.countryId, row.countryName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const filterClass = cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[150px]");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const [prices, airlineList, countryList] = await Promise.all([
          getJson<OtbPriceData[]>("/api/admin/otb-prices"),
          getJson<Option[]>("/api/admin/airlines"),
          getJson<Option[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setRows(prices);
        setAirlines(airlineList.filter((a) => a.active && a.otbRequired));
        setCountries(countryList.filter((c) => c.active));
        setState("success");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  if (state === "loading") return <Skeleton className="h-64 w-full" />;
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load OTB prices"
        description="Please try again."
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((n) => n + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {visibleRows.length === 0 ? (
        <EmptyState title="No OTB prices yet" description="Until you add one, each airline's own normal / urgent price is charged." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
              <label htmlFor="otb-price-search" className="sr-only">
                Search OTB prices
              </label>
              <input
                id="otb-price-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Search by airline or destination…"
                className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
              />
            </div>
            <label htmlFor="otb-price-filter-airline" className="sr-only">
              Filter by airline
            </label>
            <select
              id="otb-price-filter-airline"
              value={airlineFilter}
              onChange={(event) => {
                setAirlineFilter(event.target.value);
                resetPage();
              }}
              className={filterClass}
            >
              <option value="">All airlines</option>
              {airlineOptions.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            {countryId ? null : (
              <>
                <label htmlFor="otb-price-filter-country" className="sr-only">
                  Filter by destination country
                </label>
                <select
                  id="otb-price-filter-country"
                  value={countryFilter}
                  onChange={(event) => {
                    setCountryFilter(event.target.value);
                    resetPage();
                  }}
                  className={filterClass}
                >
                  <option value="">All destinations</option>
                  {countryOptions.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label htmlFor="otb-price-filter-pax" className="sr-only">
              Filter by passenger type
            </label>
            <select
              id="otb-price-filter-pax"
              value={paxFilter}
              onChange={(event) => {
                setPaxFilter(event.target.value as PaxType | "");
                resetPage();
              }}
              className={filterClass}
            >
              <option value="">All passenger types</option>
              {(Object.keys(PAX_LABELS) as PaxType[]).map((pax) => (
                <option key={pax} value={pax}>
                  {PAX_LABELS[pax]}
                </option>
              ))}
            </select>
            <label htmlFor="otb-price-filter-active" className="sr-only">
              Filter by status
            </label>
            <select
              id="otb-price-filter-active"
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
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-5 w-5" aria-hidden="true" />}
              title="No OTB prices match these filters"
              description={`None of the ${visibleRows.length} OTB prices match. Try a different search term or clear the filters.`}
              action={
                <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              {pageItems.map((row) => (
                <PriceRow key={row.id} row={row} onSaved={(updated) => setRows((current) => current.map((r) => (r.id === updated.id ? updated : r)))} />
              ))}
              <ListPagination noun="OTB price" {...paginationProps} />
            </>
          )}
        </>
      )}
      <NewPriceForm key={countryId ?? ""} defaultCountryId={countryId} airlines={airlines} countries={countries} onCreated={(created) => setRows((current) => [...current, created])} />
    </div>
  );
}
