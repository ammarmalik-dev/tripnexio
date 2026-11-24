"use client";

import { entryKindLabel } from "@/lib/new-visa/products";
import { useEffect, useMemo, useState } from "react";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { FormField, fieldBorderClass, fieldControlClass } from "@/components/forms/FormField";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { toast } from "@/components/ui/Toaster";
import { getJson, patchJson, postJson, ApiError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format-currency";

type RateService = "OTB" | "RETURN_TICKET" | "NEW_VISA";
const SERVICE_LABELS: Record<RateService, string> = { OTB: "OTB", RETURN_TICKET: "Return Ticket", NEW_VISA: "New Visa" };
const PROCESSING_LABELS: Record<string, string> = { normal: "Normal", urgent: "Urgent / Express" };
const PAX_LABELS: Record<string, string> = { ADULT: "Adult", CHILD: "Child" };

interface RateRow {
  id: string;
  vendorId: string;
  vendorName: string;
  serviceType: RateService;
  countryId: string;
  countryName: string;
  airlineId: string | null;
  airlineName: string | null;
  processingType: string | null;
  nationalityId: string | null;
  nationalityName: string | null;
  paxType: string | null;
  /** Client doc 2026-10-27 (E2) — New Visa: the visa option / type; null = any. */
  newVisaConfigId: string | null;
  newVisaConfigLabel: string | null;
  cost: number;
  active: boolean;
}

/** A New Visa option (visa type) of a country, for the vendor-rate form. */
interface VisaOption {
  id: string;
  countryId: string;
  label: string;
}

interface NewVisaConfigRow {
  id: string;
  countryId: string;
  visaCategory: string;
  stayDays: number | null;
  entryKind: string | null;
  duration: string;
  active: boolean;
}

interface Option {
  id: string;
  name: string;
  active: boolean;
}

interface VendorOption extends Option {
  services: { service: string }[];
}

type FieldErrors = Record<string, string[] | undefined>;

function money(value: number): string {
  return formatRupees(value);
}

/** Client doc 16 Nov (K9) — Add a rate, or (with `row`) edit every column of one. */
function RateForm({
  vendors,
  countries,
  airlines,
  nationalities,
  visaOptions,
  onCreated,
  row,
  onCancel,
}: {
  vendors: VendorOption[];
  countries: Option[];
  airlines: Option[];
  nationalities: Option[];
  visaOptions: VisaOption[];
  onCreated: (row: RateRow) => void;
  row?: RateRow;
  onCancel?: () => void;
}) {
  const empty = { vendorId: "", serviceType: "OTB" as RateService, countryId: "", airlineId: "", nationalityId: "", paxType: "", newVisaConfigId: "", processingType: "", cost: "" };
  const initial = row
    ? {
        vendorId: row.vendorId,
        serviceType: row.serviceType,
        countryId: row.countryId,
        airlineId: row.airlineId ?? "",
        nationalityId: row.nationalityId ?? "",
        paxType: row.paxType ?? "",
        newVisaConfigId: row.newVisaConfigId ?? "",
        processingType: row.processingType ?? "",
        cost: String(row.cost),
      }
    : empty;
  const [form, setForm] = useState(initial);
  const [active, setActive] = useState(row?.active ?? true);
  const idp = row ? `vr-${row.id}` : "vr";
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const serviceVendors = vendors.filter((vendor) => (vendor.active || vendor.id === row?.vendorId) && vendor.services.some((entry) => entry.service === form.serviceType));
  const shownVendors = serviceVendors.length > 0 ? serviceVendors : vendors.filter((vendor) => vendor.active || vendor.id === row?.vendorId);

  const select = (id: string, label: string, value: string, onChange: (value: string) => void, options: { value: string; label: string }[], error?: string, placeholder?: string) => (
    <FormField label={label} htmlFor={id} error={error}>
      <select id={id} value={value} disabled={saving} onChange={(event) => onChange(event.target.value)} className={cn(fieldControlClass, fieldBorderClass(Boolean(error)))}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );

  const create = async () => {
    const cost = Number(form.cost);
    const reason = await confirm({
      title: row ? `Save ${row.vendorName}'s rate?` : "Add this vendor rate?",
      description:
        form.serviceType === "NEW_VISA"
          ? "New Visa passengers for this country / visa type / nationality / passenger type / processing type get this cost when this vendor is picked."
          : "Bookings for this country / airline / processing type get this cost per passenger when this vendor is picked.",
      confirmLabel: row ? "Save Rate" : "Add Rate",
    });
    if (!reason) return;
    setSaving(true);
    setErrors({});
    try {
      const payload = {
        vendorId: form.vendorId,
        serviceType: form.serviceType,
        countryId: form.countryId,
        airlineId: form.serviceType === "OTB" ? form.airlineId : "",
        nationalityId: form.serviceType === "NEW_VISA" ? form.nationalityId : "",
        paxType: form.serviceType === "NEW_VISA" ? form.paxType : "",
        newVisaConfigId: form.serviceType === "NEW_VISA" ? form.newVisaConfigId : "",
        processingType: form.processingType,
        cost,
        reason,
      };
      if (row) {
        const updated = await patchJson<RateRow>(`/api/admin/vendor-service-rates/${row.id}`, { ...payload, active });
        toast.success("Vendor rate saved.");
        onCreated(updated);
        return;
      }
      const created = await postJson<RateRow>("/api/admin/vendor-service-rates", payload);
      toast.success("Vendor rate added.");
      onCreated(created);
      setForm({ ...empty, vendorId: form.vendorId, serviceType: form.serviceType });
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : "Couldn't save the rate. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.vendorId && form.countryId && form.cost.trim() !== "" && Number(form.cost) >= 0;

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border bg-surface-1 p-4", row ? "mt-2 border-accent/25" : "border-dashed border-hairline")}>
      <p className="text-sm font-semibold text-ink-heading">{row ? "Edit vendor rate" : "Add a vendor rate"}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {select(
          `${idp}-service`,
          "Service",
          form.serviceType,
          (value) => setForm({ ...form, serviceType: value as RateService, vendorId: "", airlineId: "", nationalityId: "", paxType: "", newVisaConfigId: "" }),
          (Object.keys(SERVICE_LABELS) as RateService[]).map((key) => ({ value: key, label: SERVICE_LABELS[key] }))
        )}
        {select(`${idp}-vendor`, "Vendor", form.vendorId, (value) => setForm({ ...form, vendorId: value }), shownVendors.map((v) => ({ value: v.id, label: v.name })), errors.vendorId?.[0], "Select a vendor")}
        {select(`${idp}-country`, "Destination country", form.countryId, (value) => setForm({ ...form, countryId: value, newVisaConfigId: "" }), countries.map((c) => ({ value: c.id, label: c.name })), errors.countryId?.[0], "Select a country")}
        {form.serviceType === "OTB"
          ? select(`${idp}-airline`, "Airline", form.airlineId, (value) => setForm({ ...form, airlineId: value }), airlines.map((a) => ({ value: a.id, label: a.name })), errors.airlineId?.[0], "Any airline")
          : null}
        {form.serviceType === "NEW_VISA"
          ? select(
              `${idp}-visa-type`,
              "Visa type",
              form.newVisaConfigId,
              (value) => setForm({ ...form, newVisaConfigId: value }),
              visaOptions.filter((option) => option.countryId === form.countryId).map((option) => ({ value: option.id, label: option.label })),
              errors.newVisaConfigId?.[0],
              form.countryId ? "Any visa type" : "Select a country first"
            )
          : null}
        {form.serviceType === "NEW_VISA"
          ? select(`${idp}-nationality`, "Nationality", form.nationalityId, (value) => setForm({ ...form, nationalityId: value }), nationalities.map((n) => ({ value: n.id, label: n.name })), errors.nationalityId?.[0], "Any nationality")
          : null}
        {form.serviceType === "NEW_VISA"
          ? select(`${idp}-pax`, "Passenger type", form.paxType, (value) => setForm({ ...form, paxType: value }), Object.entries(PAX_LABELS).map(([value, label]) => ({ value, label })), errors.paxType?.[0], "Adult and Child")
          : null}
        {select(
          `${idp}-processing`,
          "Processing type",
          form.processingType,
          (value) => setForm({ ...form, processingType: value }),
          Object.entries(PROCESSING_LABELS).map(([value, label]) => ({ value, label })),
          errors.processingType?.[0],
          "Any"
        )}
        <FormField label="Cost per passenger (₹)" htmlFor={`${idp}-cost`} error={errors.cost?.[0]}>
          <input
            id={`${idp}-cost`}
            type="number"
            min={0}
            step="0.01"
            value={form.cost}
            disabled={saving}
            onChange={(event) => setForm({ ...form, cost: event.target.value })}
            className={cn(fieldControlClass, fieldBorderClass(Boolean(errors.cost)))}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {row ? (
          <div className="mr-auto flex items-center gap-2 text-xs text-ink-secondary">
            <Switch checked={active} onChange={setActive} label="Rate active" />
            Active
          </div>
        ) : null}
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
        <Button type="button" size="sm" onClick={() => void create()} isLoading={saving} disabled={!canSubmit}>
          {row ? null : <Plus className="h-4 w-4" aria-hidden="true" />}
          {row ? "Save Rate" : "Add Rate"}
        </Button>
      </div>
      {dialog}
    </div>
  );
}

/**
 * Client doc 2026-10-14 — "Return ticket rate working for website but need to
 * make for vendor as well: Return Ticket and OTB by vendor, by country, by
 * airline, by processing type". What each vendor charges TripNexio (internal);
 * picking the vendor on an OTB / Return Ticket booking sets its vendor cost.
 * Client doc 2026-10-15 — New Visa by country, nationality, Adult / Child and
 * processing type; the vendor cost drives profit and the invoice.
 */
export function VendorServiceRatesManager() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [rows, setRows] = useState<RateRow[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [countries, setCountries] = useState<Option[]>([]);
  const [airlines, setAirlines] = useState<Option[]>([]);
  const [nationalities, setNationalities] = useState<Option[]>([]);
  const [visaOptions, setVisaOptions] = useState<VisaOption[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<RateService | "">("");
  // Client doc 16 Nov (K9) — filters for Service, Country and Vendor.
  const [countryFilter, setCountryFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const [rateList, vendorList, countryList, airlineList, nationalityList] = await Promise.all([
          getJson<RateRow[]>("/api/admin/vendor-service-rates"),
          getJson<VendorOption[]>("/api/admin/vendors"),
          getJson<Option[]>("/api/admin/countries"),
          getJson<Option[]>("/api/admin/airlines"),
          getJson<Option[]>("/api/admin/nationalities"),
        ]);
        // Client doc 2026-10-27 (E2) — each country's New Visa options (visa types); an empty list when not readable.
        const configs = await getJson<NewVisaConfigRow[]>("/api/admin/new-visa-countries").catch(() => [] as NewVisaConfigRow[]);
        if (cancelled) return;
        setVisaOptions(
          configs
            .filter((config) => config.active)
            .map((config) => ({
              id: config.id,
              countryId: config.countryId,
              label: [config.visaCategory, config.stayDays ? `${config.stayDays} days` : config.duration, config.entryKind ? entryKindLabel(config.entryKind) : null]
                .filter(Boolean)
                .join(" · "),
            }))
        );
        setRows(rateList);
        setVendors(vendorList);
        setCountries(countryList.filter((c) => c.active));
        setAirlines(airlineList.filter((a) => a.active));
        setNationalities(nationalityList.filter((n) => n.active));
        setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadNonce]);

  const visible = useMemo(
    () =>
      rows.filter(
        (row) => (!serviceFilter || row.serviceType === serviceFilter) && (!countryFilter || row.countryId === countryFilter) && (!vendorFilter || row.vendorId === vendorFilter)
      ),
    [rows, serviceFilter, countryFilter, vendorFilter]
  );
  // Audit 23 Oct — paginated like the other masters.
  const { pageItems, paginationProps, resetPage } = useClientPagination(visible);
  const rateCountries = [...new Map(rows.map((row) => [row.countryId, row.countryName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  const rateVendors = [...new Map(rows.map((row) => [row.vendorId, row.vendorName])).entries()].sort((a, b) => a[1].localeCompare(b[1]));

  if (state === "loading") return <Skeleton className="h-48 w-full rounded-xl" />;
  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load vendor rates"
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-secondary">What each vendor charges per passenger (internal — never shown to customers).</p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <span className="sr-only">Filter by service</span>
            <select
              value={serviceFilter}
              onChange={(event) => {
                setServiceFilter(event.target.value as RateService | "");
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-40 text-sm")}
            >
              <option value="">All services</option>
              <option value="OTB">OTB</option>
              <option value="RETURN_TICKET">Return Ticket</option>
              <option value="NEW_VISA">New Visa</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <span className="sr-only">Filter by country</span>
            <select
              value={countryFilter}
              onChange={(event) => {
                setCountryFilter(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-44 text-sm")}
            >
              <option value="">All countries</option>
              {rateCountries.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-secondary">
            <span className="sr-only">Filter by vendor</span>
            <select
              value={vendorFilter}
              onChange={(event) => {
                setVendorFilter(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-44 text-sm")}
            >
              <option value="">All vendors</option>
              {rateVendors.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title={rows.length ? "No vendor rates match these filters" : "No vendor rates yet"}
          description={rows.length ? "Pick another service, country or vendor." : "Add what each vendor charges for OTB / Return Ticket / New Visa below."}
        />
      ) : (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface-1">
          {pageItems.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", row.active ? "text-ink-primary" : "text-ink-tertiary line-through")}>
                    {row.vendorName} · {SERVICE_LABELS[row.serviceType]} · {row.countryName}
                  </p>
                  <p className="text-xs text-ink-tertiary">
                    {row.serviceType === "NEW_VISA"
                      ? `${row.newVisaConfigLabel ?? "Any visa type"} · ${row.nationalityName ?? "Any nationality"} · ${row.paxType ? (PAX_LABELS[row.paxType] ?? row.paxType) : "Adult and Child"}`
                      : row.serviceType === "OTB"
                        ? (row.airlineName ?? "Any airline")
                        : "All airlines"}{" "}
                    · {row.processingType ? PROCESSING_LABELS[row.processingType] ?? row.processingType : "Any processing"}
                    {row.active ? "" : " · disabled"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-heading">{money(row.cost)}</span>
                  {editingId !== row.id ? (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(row.id)}>
                      Edit
                    </Button>
                  ) : null}
                </div>
              </div>
              {editingId === row.id ? (
                <RateForm
                  row={row}
                  vendors={vendors}
                  countries={countries.some((c) => c.id === row.countryId) ? countries : [...countries, { id: row.countryId, name: row.countryName, active: false }]}
                  airlines={airlines}
                  nationalities={nationalities}
                  visaOptions={visaOptions}
                  onCancel={() => setEditingId(null)}
                  onCreated={(updated) => {
                    setRows((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
                    setEditingId(null);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <ListPagination noun="vendor rate" {...paginationProps} />

      <RateForm vendors={vendors} countries={countries} airlines={airlines} nationalities={nationalities} visaOptions={visaOptions} onCreated={(created) => setRows((current) => [...current, created])} />
    </div>
  );
}
