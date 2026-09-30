"use client";

import { useEffect, useState } from "react";
import { ChevronDown, History, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS, PAX_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { NationalitySelect, nationalityFormValue, nationalityPayload } from "./NationalitySelect";
import { ChangeHistoryList, type ChangeHistoryEntry, type HistoryJson } from "./ChangeHistoryList";
import type { ServiceType, PaxType } from "../../generated/prisma/enums";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";

const PAX_TYPE_OPTIONS = (Object.entries(PAX_TYPE_LABELS) as [PaxType, string][]).map(([value, label]) => ({ value, label }));
/** Used only for a service with no Processing Types configured yet (the pre-P23 codes). */
const LEGACY_PROCESSING_TYPES = [
  { code: "normal", label: "Normal" },
  { code: "urgent", label: "Urgent" },
];

interface CountryData {
  id: string;
  name: string;
  active: boolean;
}

interface SubServiceOption {
  id: string;
  serviceType: ServiceType;
  code: string;
  name: string;
  active: boolean;
}

interface ProcessingTypeOptionData {
  id: string;
  serviceType: ServiceType;
  code: string;
  label: string;
  active: boolean;
}

interface VisaTypeData {
  id: string;
  name: string;
  countryId: string | null;
  active: boolean;
}

interface ServiceOptions {
  subServices: SubServiceOption[];
  processingTypes: ProcessingTypeOptionData[];
}

interface PricingRuleData {
  id: string;
  serviceType: ServiceType;
  countryId: string | null;
  country: { id: string; name: string; code: string } | null;
  processingType: string | null;
  paxType: PaxType;
  nationality: string | null;
  nationalityId: string | null;
  newVisaConfigId: string | null;
  subServiceId: string | null;
  visaTypeId: string | null;
  vendorCost: string;
  sellingPrice: string;
  additionalCharges: string;
  validityFrom: string | null;
  validityUntil: string | null;
  active: boolean;
  updatedAt: string;
}

type FetchState = "loading" | "success" | "error";

/** P10 — a New Visa product (country + stay + entry) a price can target. */
interface NewVisaProductOption {
  id: string;
  countryId: string;
  label: string;
}

interface NewVisaProductRow {
  id: string;
  countryId: string;
  stayDays: number | null;
  entryKind: "SINGLE" | "MULTIPLE" | null;
  duration: string;
  entryType: string;
}

/** Everything the rule forms and history panels need to resolve ids to labels. */
interface Lookups {
  countries: CountryData[];
  products: NewVisaProductOption[];
  visaTypes: VisaTypeData[];
  serviceOptions: Partial<Record<ServiceType, ServiceOptions>>;
}

interface FormState {
  serviceType: ServiceType | "";
  countryId: string;
  subServiceId: string;
  visaTypeId: string;
  processingType: string;
  paxType: PaxType | "";
  nationality: string;
  newVisaConfigId: string;
  vendorCost: string;
  sellingPrice: string;
  additionalCharges: string;
  validityFrom: string;
  validityUntil: string;
}

const EMPTY_FORM: FormState = {
  serviceType: "",
  countryId: "",
  subServiceId: "",
  visaTypeId: "",
  processingType: "",
  paxType: "",
  nationality: "",
  newVisaConfigId: "",
  vendorCost: "0",
  sellingPrice: "",
  additionalCharges: "0",
  validityFrom: "",
  validityUntil: "",
};

function toFormState(rule: PricingRuleData): FormState {
  return {
    serviceType: rule.serviceType,
    countryId: rule.countryId ?? "",
    subServiceId: rule.subServiceId ?? "",
    visaTypeId: rule.visaTypeId ?? "",
    processingType: rule.processingType ?? "",
    paxType: rule.paxType,
    nationality: nationalityFormValue(rule),
    newVisaConfigId: rule.newVisaConfigId ?? "",
    vendorCost: rule.vendorCost,
    sellingPrice: rule.sellingPrice,
    additionalCharges: rule.additionalCharges,
    validityFrom: rule.validityFrom ? rule.validityFrom.slice(0, 10) : "",
    validityUntil: rule.validityUntil ? rule.validityUntil.slice(0, 10) : "",
  };
}

/** Processing options for a service: its configured Processing Types, else the legacy codes. */
function processingOptionsFor(serviceType: ServiceType | "", lookups: Lookups, currentCode: string) {
  const configured = serviceType ? (lookups.serviceOptions[serviceType]?.processingTypes ?? []) : [];
  const base =
    configured.length > 0
      ? configured.filter((option) => option.active || option.code === currentCode).map((option) => ({ code: option.code, label: option.label }))
      : LEGACY_PROCESSING_TYPES.map((option) => ({
          code: option.code,
          label: serviceType === "NEW_VISA" && option.code === "urgent" ? "Express" : option.label,
        }));
  if (currentCode && !base.some((option) => option.code === currentCode)) {
    base.push({ code: currentCode, label: `${currentCode} (not configured)` });
  }
  return base;
}

function processingLabel(serviceType: ServiceType | "", code: string, lookups: Lookups): string {
  return processingOptionsFor(serviceType, lookups, code).find((option) => option.code === code)?.label ?? code;
}

function PricingFields({
  idPrefix,
  form,
  onChange,
  errors,
  disabled,
  lookups,
  currentNationalityName,
}: {
  idPrefix: string;
  form: FormState;
  onChange: (next: FormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
  lookups: Lookups;
  currentNationalityName?: string | null;
}) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const subServices = form.serviceType
    ? (lookups.serviceOptions[form.serviceType]?.subServices ?? []).filter((entry) => entry.active || entry.id === form.subServiceId)
    : [];
  const visaTypes = lookups.visaTypes.filter(
    (entry) => entry.id === form.visaTypeId || (entry.active && (!entry.countryId || !form.countryId || entry.countryId === form.countryId))
  );
  const countries = lookups.countries.filter((entry) => entry.active || entry.id === form.countryId);
  const processingOptions = processingOptionsFor(form.serviceType, lookups, form.processingType);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Service" htmlFor={id("serviceType")} error={errors.serviceType?.[0]}>
        <select
          id={id("serviceType")}
          value={form.serviceType}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...form, serviceType: event.target.value as ServiceType, subServiceId: "", processingType: "", newVisaConfigId: "" })
          }
          className={cn(fieldControlClass, fieldBorderClass(!!errors.serviceType))}
        >
          <option value="" disabled>
            Select a service
          </option>
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Sub-service"
        htmlFor={id("subServiceId")}
        error={errors.subServiceId?.[0]}
        hint={form.serviceType && subServices.length === 0 ? "No sub-services configured for this service." : "Optional — leave unset for every sub-service."}
      >
        <select
          id={id("subServiceId")}
          value={form.subServiceId}
          disabled={disabled || !form.serviceType || subServices.length === 0}
          onChange={(event) => onChange({ ...form, subServiceId: event.target.value })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.subServiceId))}
        >
          <option value="">Every sub-service</option>
          {subServices.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
              {entry.active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Country"
        htmlFor={id("countryId")}
        error={errors.countryId?.[0]}
        hint="Optional — leave unset for a rule not tied to a destination country."
      >
        <select
          id={id("countryId")}
          value={form.countryId}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, countryId: event.target.value, newVisaConfigId: "" })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.countryId))}
        >
          <option value="">All countries (not country-specific)</option>
          {countries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      </FormField>
      {form.serviceType === "NEW_VISA" && form.countryId ? (
        <FormField label="New Visa product" htmlFor={id("newVisaConfigId")} error={errors.newVisaConfigId?.[0]}>
          <select
            id={id("newVisaConfigId")}
            value={form.newVisaConfigId}
            disabled={disabled}
            onChange={(event) => onChange({ ...form, newVisaConfigId: event.target.value })}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.newVisaConfigId))}
          >
            <option value="">Every product of this country</option>
            {lookups.products
              .filter((product) => product.countryId === form.countryId)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.label}
                </option>
              ))}
          </select>
        </FormField>
      ) : null}
      <FormField label="Visa Type" htmlFor={id("visaTypeId")} error={errors.visaTypeId?.[0]} hint="Optional — leave unset for every visa type.">
        <select
          id={id("visaTypeId")}
          value={form.visaTypeId}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, visaTypeId: event.target.value })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.visaTypeId))}
        >
          <option value="">Every visa type</option>
          {visaTypes.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
              {entry.countryId ? ` — ${lookups.countries.find((c) => c.id === entry.countryId)?.name ?? "country-specific"}` : ""}
              {entry.active ? "" : " (inactive)"}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Processing Type" htmlFor={id("processingType")} error={errors.processingType?.[0]}>
        <select
          id={id("processingType")}
          value={form.processingType}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, processingType: event.target.value })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.processingType))}
        >
          <option value="">Any / not applicable</option>
          {processingOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Passenger Type" htmlFor={id("paxType")} error={errors.paxType?.[0]}>
        <select
          id={id("paxType")}
          value={form.paxType}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, paxType: event.target.value as PaxType })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.paxType))}
        >
          <option value="" disabled>
            Select a passenger type
          </option>
          {PAX_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <NationalitySelect
        id={id("nationality")}
        value={form.nationality}
        onChange={(value) => onChange({ ...form, nationality: value })}
        currentName={currentNationalityName}
        error={errors.nationalityId?.[0] ?? errors.nationality?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Vendor Cost (₹)"
        name={id("vendorCost")}
        type="number"
        step="0.01"
        value={form.vendorCost}
        onChange={(event) => onChange({ ...form, vendorCost: event.target.value })}
        error={errors.vendorCost?.[0]}
        disabled={disabled}
        hint="Internal — never shown to the customer."
      />
      <TextField
        label="Selling Price (₹)"
        name={id("sellingPrice")}
        type="number"
        step="0.01"
        value={form.sellingPrice}
        onChange={(event) => onChange({ ...form, sellingPrice: event.target.value })}
        error={errors.sellingPrice?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Additional Charges (₹)"
        name={id("additionalCharges")}
        type="number"
        step="0.01"
        value={form.additionalCharges}
        onChange={(event) => onChange({ ...form, additionalCharges: event.target.value })}
        error={errors.additionalCharges?.[0]}
        disabled={disabled}
        hint="e.g. service fee, processing charge."
      />
      <TextField
        label="Validity From"
        name={id("validityFrom")}
        type="date"
        value={form.validityFrom}
        onChange={(event) => onChange({ ...form, validityFrom: event.target.value })}
        error={errors.validityFrom?.[0]}
        disabled={disabled}
        hint="Optional."
      />
      <TextField
        label="Validity Until"
        name={id("validityUntil")}
        type="date"
        value={form.validityUntil}
        onChange={(event) => onChange({ ...form, validityUntil: event.target.value })}
        error={errors.validityUntil?.[0]}
        disabled={disabled}
        hint="Optional."
      />
    </div>
  );
}

function buildPayload(form: FormState) {
  return {
    serviceType: form.serviceType || undefined,
    countryId: form.countryId === "" ? null : form.countryId,
    subServiceId: form.subServiceId === "" ? null : form.subServiceId,
    visaTypeId: form.visaTypeId === "" ? null : form.visaTypeId,
    processingType: form.processingType === "" ? null : form.processingType,
    paxType: form.paxType || undefined,
    nationalityId: nationalityPayload(form.nationality),
    newVisaConfigId: form.serviceType === "NEW_VISA" && form.newVisaConfigId ? form.newVisaConfigId : null,
    vendorCost: form.vendorCost === "" ? 0 : Number(form.vendorCost),
    sellingPrice: form.sellingPrice === "" ? undefined : Number(form.sellingPrice),
    additionalCharges: form.additionalCharges === "" ? 0 : Number(form.additionalCharges),
    // "" clears a date on update (the API maps an empty string to null) and is ignored on create.
    validityFrom: form.validityFrom,
    validityUntil: form.validityUntil,
  };
}

const HISTORY_FIELD_LABELS: Record<string, string> = {
  serviceType: "Service",
  countryId: "Country",
  subServiceId: "Sub-service",
  visaTypeId: "Visa type",
  newVisaConfigId: "New Visa product",
  processingType: "Processing type",
  paxType: "Passenger type",
  nationalityId: "Nationality (master)",
  nationality: "Nationality",
  vendorCost: "Vendor cost (internal)",
  sellingPrice: "Selling price",
  additionalCharges: "Additional charges",
  validityFrom: "Validity from",
  validityUntil: "Validity until",
  active: "Active",
};

const MONEY_FIELDS = new Set(["vendorCost", "sellingPrice", "additionalCharges"]);

function PricingRuleHistoryPanel({ rule, lookups }: { rule: PricingRuleData; lookups: Lookups }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<FetchState | "idle">("idle");
  const [entries, setEntries] = useState<ChangeHistoryEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const load = async () => {
    setState("loading");
    try {
      const result = await getJson<ChangeHistoryEntry[]>(`/api/admin/pricing-rules/${rule.id}/history`);
      setEntries(result);
      setState("success");
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load this rule's history.");
      setState("error");
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && state !== "success") void load();
  };

  const formatValue = (field: string, value: HistoryJson): string | undefined => {
    if (value === null || value === "") return undefined;
    const text = String(value);
    switch (field) {
      case "serviceType":
        return SERVICE_TYPE_LABELS[text as ServiceType] ?? text;
      case "paxType":
        return PAX_TYPE_LABELS[text as PaxType] ?? text;
      case "countryId":
        return lookups.countries.find((entry) => entry.id === text)?.name ?? text;
      case "visaTypeId":
        return lookups.visaTypes.find((entry) => entry.id === text)?.name ?? text;
      case "newVisaConfigId":
        return lookups.products.find((entry) => entry.id === text)?.label ?? text;
      case "subServiceId": {
        const all = Object.values(lookups.serviceOptions).flatMap((options) => options?.subServices ?? []);
        return all.find((entry) => entry.id === text)?.name ?? text;
      }
      case "processingType":
        return processingLabel(rule.serviceType, text, lookups);
      case "validityFrom":
      case "validityUntil":
        return text.slice(0, 10);
      default:
        return MONEY_FIELDS.has(field) ? `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : undefined;
    }
  };

  const panelId = `pricing-history-${rule.id}`;

  return (
    <div className="border-t border-hairline pt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-ink-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <History className="h-4 w-4" aria-hidden="true" />
        History
        <ChevronDown className={cn("h-4 w-4 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div id={panelId} className="mt-3">
          {state === "loading" || state === "idle" ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : state === "error" ? (
            <ErrorState
              title="Couldn't load history"
              description={errorMessage}
              action={
                <Button type="button" size="sm" onClick={() => void load()}>
                  Try again
                </Button>
              }
            />
          ) : entries.length === 0 ? (
            <EmptyState title="No history yet" description="Changes to this rule are recorded from now on." />
          ) : (
            <ChangeHistoryList entries={entries} fieldLabel={(field) => HISTORY_FIELD_LABELS[field] ?? field} formatValue={formatValue} />
          )}
        </div>
      ) : null}
    </div>
  );
}

function PricingCard({ rule, lookups, onSaved }: { rule: PricingRuleData; lookups: Lookups; onSaved: (rule: PricingRuleData) => void }) {
  const { confirm, dialog } = useConfirmAction();
  const [form, setForm] = useState<FormState>(toFormState(rule));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(rule));

  const handleSave = async () => {
    const reason = await confirm({
      title: "Change this pricing rule?",
      description: `Selling price ₹${rule.sellingPrice} → ₹${form.sellingPrice || "?"}. New quotes and checkouts matching this rule will use the updated pricing.`,
      confirmLabel: "Save Pricing",
    });
    if (!reason) return;
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<PricingRuleData>(`/api/admin/pricing-rules/${rule.id}`, { ...buildPayload(form), reason });
      toast.success("Pricing rule updated.");
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this pricing rule. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const reason = await confirm({
      title: `${rule.active ? "Disable" : "Enable"} this pricing rule?`,
      description: rule.active ? "Requests matching this rule will stop using its price." : "Requests matching this rule will use its price again.",
      confirmLabel: rule.active ? "Disable Rule" : "Enable Rule",
    });
    if (!reason) return;
    setTogglingActive(true);
    try {
      const updated = await patchJson<PricingRuleData>(`/api/admin/pricing-rules/${rule.id}`, { active: !rule.active, reason });
      toast.success(updated.active ? "Enabled." : "Disabled.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this pricing rule. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn("rounded-full px-2.5 py-1 text-xs font-medium", rule.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}
        >
          {rule.active ? "Active" : "Disabled"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {rule.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <PricingFields
        idPrefix={`rule-${rule.id}`}
        form={form}
        onChange={setForm}
        errors={errors}
        disabled={saving}
        lookups={lookups}
        currentNationalityName={rule.nationality}
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
      {/* Keyed on updatedAt so a save resets the panel and the next open refetches the new entry. */}
      <PricingRuleHistoryPanel key={rule.updatedAt} rule={rule} lookups={lookups} />
      {dialog}
    </div>
  );
}

function NewPricingRuleForm({ lookups, onCreated }: { lookups: Lookups; onCreated: (rule: PricingRuleData) => void }) {
  const { confirm, dialog } = useConfirmAction();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const reason = await confirm({
      title: "Create pricing rule?",
      description: `This sets a selling price of ₹${form.sellingPrice} for matching requests.`,
      confirmLabel: "Create Rule",
    });
    if (!reason) return;
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<PricingRuleData>("/api/admin/pricing-rules", { ...buildPayload(form), reason });
      toast.success("Pricing rule created.");
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this pricing rule. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.serviceType && form.paxType && form.sellingPrice.trim() !== "";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Pricing Rule</h2>
      <PricingFields idPrefix="new-rule" form={form} onChange={setForm} errors={errors} disabled={creating} lookups={lookups} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Pricing Rule
        </Button>
      </div>
      {dialog}
    </div>
  );
}

/** Per-service sub-services + processing types; a failed lookup degrades to "none configured" rather than failing the page. */
async function loadServiceOptions(): Promise<Partial<Record<ServiceType, ServiceOptions>>> {
  const entries = await Promise.all(
    SERVICE_TYPE_OPTIONS.map(async (option) => {
      const query = `serviceType=${encodeURIComponent(option.value)}`;
      const [subServices, processingTypes] = await Promise.all([
        getJson<SubServiceOption[]>(`/api/admin/sub-services?${query}`).catch(() => [] as SubServiceOption[]),
        getJson<ProcessingTypeOptionData[]>(`/api/admin/processing-types?${query}`).catch(() => [] as ProcessingTypeOptionData[]),
      ]);
      return [option.value, { subServices, processingTypes }] as const;
    })
  );
  const result: Partial<Record<ServiceType, ServiceOptions>> = {};
  for (const [serviceType, options] of entries) result[serviceType] = options;
  return result;
}

/**
 * Step 40 (Admin FINAL handover §4): "Use the existing Pricing module as
 * the central pricing control" — this is now the real price-computation
 * source for New Visa (and any future auto-priced service), not just a
 * staff-facing reference table. Deliberately does NOT cover OTB
 * (Airline.normalPrice/urgentPrice, keyed by airline not country) or
 * Return Ticket (ReturnTicketDestination.ratePerApplicant, flat rate,
 * currently no adult/child/infant split) — see PricingRule's own schema
 * doc comment for why those two were flagged rather than force-merged.
 * P23 — each rule also carries an optional sub-service / visa type, a
 * processing type from the Processing Types master, and a per-rule change
 * history (PricingRuleHistory).
 */
export function PricingRulesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [rules, setRules] = useState<PricingRuleData[]>([]);
  const [lookups, setLookups] = useState<Lookups>({ countries: [], products: [], visaTypes: [], serviceOptions: {} });
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [ruleList, countryList, productList, visaTypeList, serviceOptions] = await Promise.all([
          getJson<PricingRuleData[]>("/api/admin/pricing-rules"),
          getJson<CountryData[]>("/api/admin/countries"),
          getJson<NewVisaProductRow[]>("/api/admin/new-visa-countries"),
          getJson<VisaTypeData[]>("/api/admin/visa-types").catch(() => [] as VisaTypeData[]),
          loadServiceOptions(),
        ]);
        if (cancelled) return;
        setRules(ruleList);
        setLookups({
          countries: countryList,
          products: productList.map((row) => ({
            id: row.id,
            countryId: row.countryId,
            label: `${row.stayDays ? `${row.stayDays} Days` : row.duration} · ${row.entryKind ? (row.entryKind === "SINGLE" ? "Single Entry" : "Multiple Entry") : row.entryType}`,
          })),
          visaTypes: visaTypeList,
          serviceOptions,
        });
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load pricing rules. Please try again.");
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
          <Skeleton key={index} className="h-56 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load pricing rules"
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
      {rules.length === 0 ? (
        <EmptyState title="No pricing rules yet" description="Add the first one using the form below." />
      ) : (
        rules.map((rule) => (
          <PricingCard
            key={rule.id}
            rule={rule}
            lookups={lookups}
            onSaved={(updated) => setRules((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewPricingRuleForm lookups={lookups} onCreated={(created) => setRules((current) => [...current, created])} />
    </div>
  );
}
