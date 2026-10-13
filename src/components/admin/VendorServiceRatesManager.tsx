"use client";

import { useEffect, useMemo, useState } from "react";
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

type RateService = "OTB" | "RETURN_TICKET";
const SERVICE_LABELS: Record<RateService, string> = { OTB: "OTB", RETURN_TICKET: "Return Ticket" };
const PROCESSING_LABELS: Record<string, string> = { normal: "Normal", urgent: "Urgent / Express" };

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
  cost: number;
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
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function RateEditor({ row, onSaved, onCancel }: { row: RateRow; onSaved: (row: RateRow) => void; onCancel: () => void }) {
  const [cost, setCost] = useState(String(row.cost));
  const [active, setActive] = useState(row.active);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  const save = async () => {
    const value = Number(cost);
    if (cost.trim() === "" || !Number.isFinite(value) || value < 0) {
      setError("Enter 0 or more.");
      return;
    }
    setError("");
    const reason = await confirm({
      title: `Change ${row.vendorName}'s rate to ${money(value)}?`,
      description: "Bookings get this cost when this vendor is picked from now on. Bookings already costed keep their figure.",
      confirmLabel: "Save Rate",
    });
    if (!reason) return;
    setSaving(true);
    try {
      const updated = await patchJson<RateRow>(`/api/admin/vendor-service-rates/${row.id}`, { cost: value, active, reason });
      toast.success("Vendor rate saved.");
      onSaved(updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't save the rate. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg border border-accent/25 bg-surface-1 p-3">
      <label className="flex flex-col gap-1 text-xs text-ink-secondary">
        <span className="font-medium">Cost per passenger (₹)</span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={cost}
          onChange={(event) => setCost(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn(fieldControlClass, fieldBorderClass(Boolean(error)), "h-9 w-40 text-sm")}
        />
        {error ? <span className="text-error">{error}</span> : null}
      </label>
      <div className="flex h-9 items-center gap-2 text-xs text-ink-secondary">
        <Switch checked={active} onChange={setActive} label="Rate active" />
        Active
      </div>
      <Button type="button" size="sm" onClick={() => void save()} isLoading={saving}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
      {dialog}
    </div>
  );
}

function NewRateForm({
  vendors,
  countries,
  airlines,
  onCreated,
}: {
  vendors: VendorOption[];
  countries: Option[];
  airlines: Option[];
  onCreated: (row: RateRow) => void;
}) {
  const empty = { vendorId: "", serviceType: "OTB" as RateService, countryId: "", airlineId: "", processingType: "", cost: "" };
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const serviceVendors = vendors.filter((vendor) => vendor.active && vendor.services.some((entry) => entry.service === form.serviceType));
  const shownVendors = serviceVendors.length > 0 ? serviceVendors : vendors.filter((vendor) => vendor.active);

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
      title: "Add this vendor rate?",
      description: "Bookings for this country / airline / processing type get this cost per passenger when this vendor is picked.",
      confirmLabel: "Add Rate",
    });
    if (!reason) return;
    setSaving(true);
    setErrors({});
    try {
      const created = await postJson<RateRow>("/api/admin/vendor-service-rates", {
        vendorId: form.vendorId,
        serviceType: form.serviceType,
        countryId: form.countryId,
        airlineId: form.serviceType === "OTB" ? form.airlineId : "",
        processingType: form.processingType,
        cost,
        reason,
      });
      toast.success("Vendor rate added.");
      onCreated(created);
      setForm({ ...empty, vendorId: form.vendorId, serviceType: form.serviceType });
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast.error(err instanceof ApiError ? err.message : "Couldn't add the rate. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = form.vendorId && form.countryId && form.cost.trim() !== "" && Number(form.cost) >= 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-4">
      <p className="text-sm font-semibold text-ink-heading">Add a vendor rate</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {select(
          "vr-service",
          "Service",
          form.serviceType,
          (value) => setForm({ ...form, serviceType: value as RateService, vendorId: "", airlineId: "" }),
          (Object.keys(SERVICE_LABELS) as RateService[]).map((key) => ({ value: key, label: SERVICE_LABELS[key] }))
        )}
        {select("vr-vendor", "Vendor", form.vendorId, (value) => setForm({ ...form, vendorId: value }), shownVendors.map((v) => ({ value: v.id, label: v.name })), errors.vendorId?.[0], "Select a vendor")}
        {select("vr-country", "Destination country", form.countryId, (value) => setForm({ ...form, countryId: value }), countries.map((c) => ({ value: c.id, label: c.name })), errors.countryId?.[0], "Select a country")}
        {form.serviceType === "OTB"
          ? select("vr-airline", "Airline", form.airlineId, (value) => setForm({ ...form, airlineId: value }), airlines.map((a) => ({ value: a.id, label: a.name })), errors.airlineId?.[0], "Any airline")
          : null}
        {select(
          "vr-processing",
          "Processing type",
          form.processingType,
          (value) => setForm({ ...form, processingType: value }),
          Object.entries(PROCESSING_LABELS).map(([value, label]) => ({ value, label })),
          errors.processingType?.[0],
          "Any"
        )}
        <FormField label="Cost per passenger (₹)" htmlFor="vr-cost" error={errors.cost?.[0]}>
          <input
            id="vr-cost"
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
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void create()} isLoading={saving} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Rate
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
 */
export function VendorServiceRatesManager() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [rows, setRows] = useState<RateRow[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [countries, setCountries] = useState<Option[]>([]);
  const [airlines, setAirlines] = useState<Option[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState<RateService | "">("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const [rateList, vendorList, countryList, airlineList] = await Promise.all([
          getJson<RateRow[]>("/api/admin/vendor-service-rates"),
          getJson<VendorOption[]>("/api/admin/vendors"),
          getJson<Option[]>("/api/admin/countries"),
          getJson<Option[]>("/api/admin/airlines"),
        ]);
        if (cancelled) return;
        setRows(rateList);
        setVendors(vendorList);
        setCountries(countryList.filter((c) => c.active));
        setAirlines(airlineList.filter((a) => a.active));
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

  const visible = useMemo(() => rows.filter((row) => !serviceFilter || row.serviceType === serviceFilter), [rows, serviceFilter]);

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
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <span className="sr-only">Filter by service</span>
          <select
            value={serviceFilter}
            onChange={(event) => setServiceFilter(event.target.value as RateService | "")}
            className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-48 text-sm")}
          >
            <option value="">OTB and Return Ticket</option>
            <option value="OTB">OTB</option>
            <option value="RETURN_TICKET">Return Ticket</option>
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No vendor rates yet" description="Add what each vendor charges for OTB / Return Ticket below." />
      ) : (
        <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface-1">
          {visible.map((row) => (
            <li key={row.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn("text-sm font-medium", row.active ? "text-ink-primary" : "text-ink-tertiary line-through")}>
                    {row.vendorName} · {SERVICE_LABELS[row.serviceType]} · {row.countryName}
                  </p>
                  <p className="text-xs text-ink-tertiary">
                    {row.serviceType === "OTB" ? (row.airlineName ?? "Any airline") : "All airlines"} · {row.processingType ? PROCESSING_LABELS[row.processingType] ?? row.processingType : "Any processing"}
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
                <RateEditor
                  row={row}
                  onCancel={() => setEditingId(null)}
                  onSaved={(updated) => {
                    setRows((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
                    setEditingId(null);
                  }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <NewRateForm vendors={vendors} countries={countries} airlines={airlines} onCreated={(created) => setRows((current) => [...current, created])} />
    </div>
  );
}
