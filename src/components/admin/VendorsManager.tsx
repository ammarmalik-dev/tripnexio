"use client";

import { useEffect, useState } from "react";
import { ChevronDown, History, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { computeVendorScore, type VendorScoringWeights } from "@/lib/vendors/score-formula";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { ChangeHistoryList, type ChangeHistoryEntry, type HistoryJson } from "./ChangeHistoryList";
import type { ServiceType } from "../../generated/prisma/enums";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";

interface VendorService {
  id: string;
  service: ServiceType;
  /** P23 — internal service-wise cost/rate (Decimal serialized as a string) and validity window. */
  cost: string | null;
  rate: string | null;
  validFrom: string | null;
  validUntil: string | null;
  updatedAt: string;
}

interface VendorData {
  id: string;
  name: string;
  mobile: string | null;
  email: string | null;
  pocName: string | null;
  processingDetails: string | null;
  availability: string | null;
  gstNumber: string | null;
  paymentDetails: string | null;
  active: boolean;
  services: VendorService[];
  serviceSuitabilityScore: number;
  processingTimeScore: number;
  performanceScore: number;
  reliabilityScore: number;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  name: string;
  services: ServiceType[];
  mobile: string;
  email: string;
  pocName: string;
  processingDetails: string;
  availability: string;
  gstNumber: string;
  paymentDetails: string;
  serviceSuitabilityScore: number;
  processingTimeScore: number;
  performanceScore: number;
  reliabilityScore: number;
}

const EMPTY_FORM: FormState = {
  name: "",
  services: [],
  mobile: "",
  email: "",
  pocName: "",
  processingDetails: "",
  availability: "",
  gstNumber: "",
  paymentDetails: "",
  serviceSuitabilityScore: 3,
  processingTimeScore: 3,
  performanceScore: 3,
  reliabilityScore: 3,
};

function toFormState(vendor: VendorData): FormState {
  return {
    name: vendor.name,
    services: vendor.services.map((entry) => entry.service),
    mobile: vendor.mobile ?? "",
    email: vendor.email ?? "",
    pocName: vendor.pocName ?? "",
    processingDetails: vendor.processingDetails ?? "",
    availability: vendor.availability ?? "",
    gstNumber: vendor.gstNumber ?? "",
    paymentDetails: vendor.paymentDetails ?? "",
    serviceSuitabilityScore: vendor.serviceSuitabilityScore,
    processingTimeScore: vendor.processingTimeScore,
    performanceScore: vendor.performanceScore,
    reliabilityScore: vendor.reliabilityScore,
  };
}

function ServiceChecklist({
  selected,
  onToggle,
  disabled,
  error,
}: {
  selected: ServiceType[];
  onToggle: (service: ServiceType) => void;
  disabled: boolean;
  error?: string;
}) {
  const selectedSet = new Set(selected);
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink-primary">
        Service Coverage <span className="text-error">*</span>
      </span>
      <div className="grid grid-cols-1 gap-2 rounded-lg border border-hairline p-3 sm:grid-cols-2">
        {SERVICE_TYPE_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-sm text-ink-secondary">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={selectedSet.has(option.value)}
              disabled={disabled}
              onChange={() => onToggle(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error ? <p className="mt-1 text-xs text-error">{error}</p> : null}
      <p className="mt-1 text-xs text-ink-tertiary">One vendor can support multiple services — no need to create it again per service.</p>
    </div>
  );
}

function VendorFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
}) {
  const toggleService = (service: ServiceType) => {
    const next = form.services.includes(service) ? form.services.filter((entry) => entry !== service) : [...form.services, service];
    onChange({ ...form, services: next });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Vendor Name"
          name="name"
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          error={errors.name?.[0]}
          disabled={disabled}
        />
        <TextField
          label="POC Name"
          name="pocName"
          value={form.pocName}
          onChange={(event) => onChange({ ...form, pocName: event.target.value })}
          error={errors.pocName?.[0]}
          disabled={disabled}
          hint="Point of contact at the vendor"
        />
        <TextField
          label="Mobile"
          name="mobile"
          value={form.mobile}
          onChange={(event) => onChange({ ...form, mobile: event.target.value })}
          error={errors.mobile?.[0]}
          disabled={disabled}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={(event) => onChange({ ...form, email: event.target.value })}
          error={errors.email?.[0]}
          disabled={disabled}
        />
        <TextField
          label="GST Number"
          name="gstNumber"
          value={form.gstNumber}
          onChange={(event) => onChange({ ...form, gstNumber: event.target.value })}
          error={errors.gstNumber?.[0]}
          disabled={disabled}
          hint="Optional — where applicable"
        />
        <TextField
          label="Availability"
          name="availability"
          value={form.availability}
          onChange={(event) => onChange({ ...form, availability: event.target.value })}
          error={errors.availability?.[0]}
          disabled={disabled}
          hint="e.g. Mon–Sat, 9am–8pm IST"
        />
      </div>
      <ServiceChecklist selected={form.services} onToggle={toggleService} disabled={disabled} error={errors.services?.[0]} />
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-primary">Vendor Selection Scores (1-5, Business Rules §8)</span>
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-hairline p-3 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="Service Suitability"
            name="serviceSuitabilityScore"
            type="number"
            min={1}
            max={5}
            value={form.serviceSuitabilityScore}
            onChange={(event) => onChange({ ...form, serviceSuitabilityScore: Number(event.target.value) })}
            error={errors.serviceSuitabilityScore?.[0]}
            disabled={disabled}
          />
          <TextField
            label="Processing Time"
            name="processingTimeScore"
            type="number"
            min={1}
            max={5}
            value={form.processingTimeScore}
            onChange={(event) => onChange({ ...form, processingTimeScore: Number(event.target.value) })}
            error={errors.processingTimeScore?.[0]}
            disabled={disabled}
          />
          <TextField
            label="Performance"
            name="performanceScore"
            type="number"
            min={1}
            max={5}
            value={form.performanceScore}
            onChange={(event) => onChange({ ...form, performanceScore: Number(event.target.value) })}
            error={errors.performanceScore?.[0]}
            disabled={disabled}
          />
          <TextField
            label="Reliability"
            name="reliabilityScore"
            type="number"
            min={1}
            max={5}
            value={form.reliabilityScore}
            onChange={(event) => onChange({ ...form, reliabilityScore: Number(event.target.value) })}
            error={errors.reliabilityScore?.[0]}
            disabled={disabled}
          />
        </div>
        <p className="mt-1 text-xs text-ink-tertiary">
          Combined into an overall recommendation score shown in the quote builder — never an auto-selection, staff
          always make the final call. Weighting is configured under Admin → Vendor Scoring.
        </p>
      </div>
      <Textarea
        label="Processing Details"
        name="processingDetails"
        value={form.processingDetails}
        onChange={(event) => onChange({ ...form, processingDetails: event.target.value })}
        error={errors.processingDetails?.[0]}
        disabled={disabled}
        rows={3}
        hint="How this vendor typically processes requests, turnaround notes, etc."
      />
      <Textarea
        label="Account / Payment Details"
        name="paymentDetails"
        value={form.paymentDetails}
        onChange={(event) => onChange({ ...form, paymentDetails: event.target.value })}
        error={errors.paymentDetails?.[0]}
        disabled={disabled}
        rows={3}
        hint="Bank/account details for settling this vendor — internal only"
      />
    </div>
  );
}

function buildPayload(form: FormState) {
  return {
    name: form.name.trim(),
    services: form.services,
    mobile: form.mobile.trim() || undefined,
    email: form.email.trim() || undefined,
    pocName: form.pocName.trim() || undefined,
    processingDetails: form.processingDetails.trim() || undefined,
    availability: form.availability.trim() || undefined,
    gstNumber: form.gstNumber.trim() || undefined,
    paymentDetails: form.paymentDetails.trim() || undefined,
    serviceSuitabilityScore: form.serviceSuitabilityScore,
    processingTimeScore: form.processingTimeScore,
    performanceScore: form.performanceScore,
    reliabilityScore: form.reliabilityScore,
  };
}

interface RateFormState {
  cost: string;
  rate: string;
  validFrom: string;
  validUntil: string;
}

function toRateForm(entry: VendorService): RateFormState {
  return {
    cost: entry.cost ?? "",
    rate: entry.rate ?? "",
    validFrom: entry.validFrom ? entry.validFrom.slice(0, 10) : "",
    validUntil: entry.validUntil ? entry.validUntil.slice(0, 10) : "",
  };
}

function VendorRateRow({ vendorId, entry, onSaved }: { vendorId: string; entry: VendorService; onSaved: (entry: VendorService) => void }) {
  const { confirm, dialog } = useConfirmAction();
  const [form, setForm] = useState<RateFormState>(toRateForm(entry));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toRateForm(entry));
  const label = SERVICE_TYPE_LABELS[entry.service];

  const handleSave = async () => {
    const reason = await confirm({
      title: `Change ${label} vendor rate?`,
      description: "This changes the vendor cost/rate used for quotes and margin on this service.",
      confirmLabel: "Save Rate",
    });
    if (!reason) return;
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<VendorService>(`/api/admin/vendors/${vendorId}/services/${entry.service}`, {
        cost: form.cost.trim() === "" ? null : Number(form.cost),
        rate: form.rate.trim() === "" ? null : Number(form.rate),
        validFrom: form.validFrom || null,
        validUntil: form.validUntil || null,
        reason,
      });
      toast.success(`${label} rate saved.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save this rate. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const errorText = errors.cost?.[0] ?? errors.rate?.[0] ?? errors.validFrom?.[0] ?? errors.validUntil?.[0];
  const cell = (field: keyof RateFormState, type: "number" | "date", ariaLabel: string) => (
    <input
      type={type}
      {...(type === "number" ? { min: 0, step: "0.01", inputMode: "decimal" as const } : {})}
      value={form[field]}
      disabled={saving}
      aria-label={`${label} ${ariaLabel}`}
      aria-invalid={!!errors[field]}
      onChange={(event) => setForm({ ...form, [field]: event.target.value })}
      className={cn(fieldControlClass, fieldBorderClass(!!errors[field]), "min-w-[8rem]")}
    />
  );

  return (
    <>
      <tr className="border-t border-hairline align-top">
        <th scope="row" className="py-2 pr-3 text-left font-medium text-ink-primary">
          {label}
        </th>
        <td className="py-2 pr-3">{cell("cost", "number", "vendor cost")}</td>
        <td className="py-2 pr-3">{cell("rate", "number", "rate")}</td>
        <td className="py-2 pr-3">{cell("validFrom", "date", "valid from")}</td>
        <td className="py-2 pr-3">{cell("validUntil", "date", "valid until")}</td>
        <td className="py-2 text-right">
          <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
            Save
          </Button>
          {dialog}
        </td>
      </tr>
      {errorText ? (
        <tr>
          <td colSpan={6} className="pb-2 text-xs text-error" role="alert">
            {errorText}
          </td>
        </tr>
      ) : null}
    </>
  );
}

const RATE_FIELD_LABELS: Record<string, string> = { cost: "Vendor cost", rate: "Rate", validFrom: "Valid from", validUntil: "Valid until" };

function formatRateValue(field: string, value: HistoryJson): string | undefined {
  if (value === null || value === "") return undefined;
  if (field === "cost" || field === "rate") return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return undefined;
}

interface RateHistoryRow extends Omit<ChangeHistoryEntry, "tag"> {
  service: ServiceType;
}

function VendorRateHistoryPanel({ vendorId, services }: { vendorId: string; services: ServiceType[] }) {
  const [open, setOpen] = useState(false);
  const [service, setService] = useState<ServiceType | "">("");
  const [state, setState] = useState<FetchState | "idle">("idle");
  const [entries, setEntries] = useState<ChangeHistoryEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const load = async (filter: ServiceType | "") => {
    setState("loading");
    try {
      const query = filter ? `?service=${encodeURIComponent(filter)}` : "";
      const rows = await getJson<RateHistoryRow[]>(`/api/admin/vendors/${vendorId}/rate-history${query}`);
      setEntries(rows.map((row) => ({ ...row, tag: SERVICE_TYPE_LABELS[row.service] })));
      setState("success");
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load rate history.");
      setState("error");
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state !== "success") void load(service);
  };

  const panelId = `vendor-rate-history-${vendorId}`;
  const filterId = `${panelId}-service`;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <History className="h-4 w-4" aria-hidden="true" />
        Rate history
        <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div id={panelId} className="mt-3 flex flex-col gap-3">
          <FormField label="Service" htmlFor={filterId} className="max-w-xs">
            <select
              id={filterId}
              value={service}
              onChange={(event) => {
                const next = event.target.value as ServiceType | "";
                setService(next);
                void load(next);
              }}
              className={cn(fieldControlClass, fieldBorderClass(false))}
            >
              <option value="">All services</option>
              {services.map((entry) => (
                <option key={entry} value={entry}>
                  {SERVICE_TYPE_LABELS[entry]}
                </option>
              ))}
            </select>
          </FormField>
          {state === "loading" || state === "idle" ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : state === "error" ? (
            <ErrorState
              title="Couldn't load rate history"
              description={errorMessage}
              action={
                <Button type="button" size="sm" onClick={() => void load(service)}>
                  Try again
                </Button>
              }
            />
          ) : entries.length === 0 ? (
            <EmptyState title="No rate changes yet" description="Saved cost/rate changes appear here." />
          ) : (
            <ChangeHistoryList entries={entries} fieldLabel={(field) => RATE_FIELD_LABELS[field] ?? field} formatValue={formatRateValue} />
          )}
        </div>
      ) : null}
    </div>
  );
}

/** P23 — ADMIN §12 "vendor cost/rate service-wise": one editable row per linked service. Internal only. */
function VendorRatesSection({ vendor, onServiceSaved }: { vendor: VendorData; onServiceSaved: (entry: VendorService) => void }) {
  // Remount the history panel after any rate save so its next open refetches.
  const latestUpdate = vendor.services.map((entry) => entry.updatedAt).join("|");
  return (
    <div className="rounded-lg border border-hairline p-3">
      <h3 className="text-sm font-medium text-ink-primary">Service-wise Cost &amp; Rate (internal)</h3>
      <p className="mt-0.5 text-xs text-ink-tertiary">
        Admin-only — never shown to customers or in staff vendor lookups. Leave a field blank if not applicable. Changing
        service coverage above keeps the rates of services that stay linked.
      </p>
      {vendor.services.length === 0 ? (
        <p className="mt-3 text-sm text-ink-tertiary">Link at least one service above to set its rate.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-tertiary">
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Service
                </th>
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Vendor Cost (₹)
                </th>
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Rate (₹)
                </th>
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Valid From
                </th>
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Valid Until
                </th>
                <th scope="col" className="pb-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {vendor.services.map((entry) => (
                <VendorRateRow
                  key={`${entry.id}-${entry.updatedAt}`}
                  vendorId={vendor.id}
                  entry={entry}
                  onSaved={onServiceSaved}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <VendorRateHistoryPanel key={latestUpdate} vendorId={vendor.id} services={vendor.services.map((entry) => entry.service)} />
    </div>
  );
}

function VendorCard({ vendor, weights, onSaved }: { vendor: VendorData; weights: VendorScoringWeights | null; onSaved: (vendor: VendorData) => void }) {
  const { confirm, dialog } = useConfirmAction();
  const [form, setForm] = useState<FormState>(toFormState(vendor));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(vendor));

  const handleSave = async () => {
    const reason = await confirm({
      title: `Update vendor "${vendor.name}"?`,
      description: "Vendor changes affect which vendor staff can pick for quotations and bookings.",
      confirmLabel: "Save Vendor",
    });
    if (!reason) return;
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<VendorData>(`/api/admin/vendors/${vendor.id}`, { ...buildPayload(form), reason });
      toast.success(`Vendor "${updated.name}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this vendor. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const reason = await confirm({
      title: `${vendor.active ? "Disable" : "Enable"} vendor "${vendor.name}"?`,
      description: vendor.active ? "Staff will no longer be able to pick this vendor for new quotations or bookings." : "Staff will be able to pick this vendor for quotations and bookings again.",
      confirmLabel: vendor.active ? "Disable Vendor" : "Enable Vendor",
    });
    if (!reason) return;
    setTogglingActive(true);
    try {
      const updated = await patchJson<VendorData>(`/api/admin/vendors/${vendor.id}`, { active: !vendor.active, reason });
      toast.success(updated.active ? `${updated.name} enabled.` : `${updated.name} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this vendor. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn("rounded-full px-2.5 py-1 text-xs font-medium", vendor.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}
        >
          {vendor.active ? "Active" : "Disabled"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {vendor.active ? "Disable" : "Enable"}
        </Button>
      </div>
      {weights ? (
        <p className="text-xs text-ink-tertiary">
          Overall recommendation score: <span className="font-medium text-ink-primary">{computeVendorScore(vendor, weights)}/5</span> (Business
          Rules §8 — sort/display aid, weighting under Admin → Vendor Scoring)
        </p>
      ) : null}
      <VendorFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
      <VendorRatesSection
        vendor={vendor}
        onServiceSaved={(entry) =>
          onSaved({ ...vendor, services: vendor.services.map((current) => (current.service === entry.service ? entry : current)) })
        }
      />
      {dialog}
    </div>
  );
}

function NewVendorForm({ onCreated }: { onCreated: (vendor: VendorData) => void }) {
  const { confirm, dialog } = useConfirmAction();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const reason = await confirm({
      title: `Create vendor "${form.name.trim()}"?`,
      description: "The new vendor becomes selectable for quotations and bookings on its services.",
      confirmLabel: "Create Vendor",
    });
    if (!reason) return;
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<VendorData>("/api/admin/vendors", { ...buildPayload(form), reason });
      toast.success(`Vendor "${created.name}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this vendor. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.name.trim() && form.services.length > 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Vendor</h2>
      <VendorFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Vendor
        </Button>
      </div>
      {dialog}
    </div>
  );
}

export function VendorsManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [weights, setWeights] = useState<VendorScoringWeights | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [result, weightsResult] = await Promise.all([
          getJson<VendorData[]>("/api/admin/vendors"),
          getJson<VendorScoringWeights>("/api/admin/vendor-scoring-config").catch(() => null),
        ]);
        if (cancelled) return;
        setVendors(result);
        setWeights(weightsResult);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load vendors. Please try again.");
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
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load vendors"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {vendors.length === 0 ? (
        <EmptyState title="No vendors yet" description="Add the first one using the form below." />
      ) : (
        vendors.map((vendor) => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            weights={weights}
            onSaved={(updated) => setVendors((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewVendorForm onCreated={(created) => setVendors((current) => [...current, created])} />
    </div>
  );
}
