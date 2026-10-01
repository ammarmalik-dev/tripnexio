"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { SelectField } from "@/components/forms/SelectField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

interface CountryData {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

interface ConfigData {
  id: string;
  countryId: string;
  country: { id: string; name: string; code: string };
  visaCategory: string;
  duration: string;
  entryType: string;
  stayDays: number | null;
  entryKind: "SINGLE" | "MULTIPLE" | null;
  displayOrder: number;
  processingType: string;
  description: string;
  termsAndConditions: string;
  active: boolean;
}

interface PricingRuleData {
  serviceType: string;
  countryId: string | null;
  paxType: string;
  processingType: string | null;
  sellingPrice: string;
}

interface DocumentRequirementData {
  serviceType: string;
  countryId: string | null;
  documentName: string;
}

interface TimelineData {
  serviceType: string;
  quotationResponseMinutes: number | null;
  paymentDeadlineHours: number | null;
}

/** What Pricing/Documents/Timeline (Steps 40-42) have configured for NEW_VISA + this country — read-only, links out rather than duplicating. */
interface ReferenceData {
  pricingRules: PricingRuleData[];
  documentRequirements: DocumentRequirementData[];
  newVisaTimeline: TimelineData | null;
}

type FetchState = "loading" | "success" | "error";
type FieldErrors = Record<string, string[] | undefined>;
type ActiveFilter = "all" | "active" | "inactive";

interface FormState {
  visaCategory: string;
  /** P10 — the product: "30" / "60" and "SINGLE" / "MULTIPLE" ("" = not set, pre-P10 row). */
  stayDays: string;
  entryKind: string;
  displayOrder: string;
  duration: string;
  entryType: string;
  processingType: string;
  description: string;
  termsAndConditions: string;
}

function toFormState(c: ConfigData): FormState {
  return {
    visaCategory: c.visaCategory,
    stayDays: c.stayDays ? String(c.stayDays) : "",
    entryKind: c.entryKind ?? "",
    displayOrder: String(c.displayOrder),
    duration: c.duration,
    entryType: c.entryType,
    processingType: c.processingType,
    description: c.description,
    termsAndConditions: c.termsAndConditions,
  };
}

const EMPTY_FORM: FormState = {
  visaCategory: "",
  stayDays: "30",
  entryKind: "SINGLE",
  displayOrder: "0",
  duration: "",
  entryType: "",
  processingType: "",
  description: "",
  termsAndConditions: "",
};

/** API body for a form: the product dimensions as numbers/enums, empty display text left for the server to derive. */
function toPayload(form: FormState) {
  return {
    visaCategory: form.visaCategory,
    ...(form.stayDays ? { stayDays: Number(form.stayDays) } : {}),
    ...(form.entryKind ? { entryKind: form.entryKind } : {}),
    displayOrder: Number(form.displayOrder) || 0,
    duration: form.duration.trim(),
    entryType: form.entryType.trim(),
    processingType: form.processingType,
    description: form.description,
    termsAndConditions: form.termsAndConditions,
  };
}

function ConfigFields({
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
  const id = (field: string) => `${idPrefix}-${field}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Stay Duration" htmlFor={id("stayDays")} error={errors.stayDays?.[0]} required>
          <select
            id={id("stayDays")}
            value={form.stayDays}
            disabled={disabled}
            onChange={(event) => onChange({ ...form, stayDays: event.target.value })}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.stayDays))}
          >
            <option value="" disabled>
              Select
            </option>
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
          </select>
        </FormField>
        <FormField label="Entry Type" htmlFor={id("entryKind")} error={errors.entryKind?.[0]} required>
          <select
            id={id("entryKind")}
            value={form.entryKind}
            disabled={disabled}
            onChange={(event) => onChange({ ...form, entryKind: event.target.value })}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.entryKind))}
          >
            <option value="" disabled>
              Select
            </option>
            <option value="SINGLE">Single Entry</option>
            <option value="MULTIPLE">Multiple Entry</option>
          </select>
        </FormField>
        <TextField
          label="Display Order"
          name={id("displayOrder")}
          type="number"
          value={form.displayOrder}
          onChange={(event) => onChange({ ...form, displayOrder: event.target.value })}
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Visa Category"
          name={id("visaCategory")}
          placeholder="e.g. Tourist / Visit Visa"
          value={form.visaCategory}
          onChange={(event) => onChange({ ...form, visaCategory: event.target.value })}
          error={errors.visaCategory?.[0]}
          disabled={disabled}
        />
        <TextField
          label="Duration text (optional)"
          name={id("duration")}
          placeholder="Defaults to e.g. 30 Days"
          value={form.duration}
          onChange={(event) => onChange({ ...form, duration: event.target.value })}
          error={errors.duration?.[0]}
          disabled={disabled}
        />
        <TextField
          label="Entry type text (optional)"
          name={id("entryType")}
          placeholder="Defaults to e.g. Single Entry"
          value={form.entryType}
          onChange={(event) => onChange({ ...form, entryType: event.target.value })}
          error={errors.entryType?.[0]}
          disabled={disabled}
        />
      </div>
      <TextField
        label="Processing Type"
        name={id("processingType")}
        placeholder="e.g. Normal & Express available"
        value={form.processingType}
        onChange={(event) => onChange({ ...form, processingType: event.target.value })}
        error={errors.processingType?.[0]}
        disabled={disabled}
      />
      <Textarea
        label="Description"
        name={id("description")}
        value={form.description}
        onChange={(event) => onChange({ ...form, description: event.target.value })}
        error={errors.description?.[0]}
        disabled={disabled}
      />
      <Textarea
        label="Terms & Conditions"
        name={id("termsAndConditions")}
        value={form.termsAndConditions}
        onChange={(event) => onChange({ ...form, termsAndConditions: event.target.value })}
        error={errors.termsAndConditions?.[0]}
        disabled={disabled}
      />
    </div>
  );
}

/** Read-only summary of what Pricing (Step 40) / Documents (Step 41) / Timeline (Step 42) already have configured for NEW_VISA + this country — connects to those controls instead of duplicating their data here. */
function ReferencePanel({ countryId, reference }: { countryId: string; reference: ReferenceData }) {
  const rules = reference.pricingRules.filter((r) => r.serviceType === "NEW_VISA" && r.countryId === countryId);
  const docs = reference.documentRequirements.filter((d) => d.serviceType === "NEW_VISA" && d.countryId === countryId);
  const timeline = reference.newVisaTimeline;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-hairline bg-surface-2 p-4 text-xs text-ink-tertiary sm:grid-cols-3">
      <div>
        <div className="font-medium text-ink-secondary">Pricing (New Visa)</div>
        {rules.length === 0 ? (
          <p>No pricing rule configured yet.</p>
        ) : (
          <p>
            {rules.length} rule{rules.length === 1 ? "" : "s"} configured.
          </p>
        )}
        <a href={`/admin/service-configuration?service=NEW_VISA&country=${countryId}&tab=pricing`} className="text-ink-accent hover:underline">
          Manage on Pricing →
        </a>
      </div>
      <div>
        <div className="font-medium text-ink-secondary">Documents (New Visa)</div>
        {docs.length === 0 ? (
          <p>No document requirement configured yet.</p>
        ) : (
          <p>
            {docs.length} document{docs.length === 1 ? "" : "s"} configured.
          </p>
        )}
        <a href={`/admin/service-configuration?service=NEW_VISA&country=${countryId}&tab=documents`} className="text-ink-accent hover:underline">
          Manage on Documents →
        </a>
      </div>
      <div>
        <div className="font-medium text-ink-secondary">Timeline (New Visa, service-wide)</div>
        {timeline?.quotationResponseMinutes == null && timeline?.paymentDeadlineHours == null ? (
          <p>Not configured — using defaults.</p>
        ) : (
          <p>
            {timeline?.quotationResponseMinutes != null ? `Quote response: ${timeline.quotationResponseMinutes}m. ` : ""}
            {timeline?.paymentDeadlineHours != null ? `Payment deadline: ${timeline.paymentDeadlineHours}h.` : ""}
          </p>
        )}
        <p className="italic">Timeline is configured per-service, not per-country, today.</p>
        <a href={`/admin/service-configuration?service=NEW_VISA&country=${countryId}&tab=timelines`} className="text-ink-accent hover:underline">
          Manage on Timelines →
        </a>
      </div>
    </div>
  );
}

function ConfigCard({
  config,
  reference,
  onSaved,
  onDeleted,
}: {
  config: ConfigData;
  reference: ReferenceData;
  onSaved: (c: ConfigData) => void;
  onDeleted: (id: string) => void;
}) {
  const [form, setForm] = useState<FormState>(toFormState(config));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const [deleting, setDeleting] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(config));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<ConfigData>(`/api/admin/new-visa-countries/${config.id}`, toPayload(form));
      toast.success(`${updated.country.name} updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this country. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const updated = await patchJson<ConfigData>(`/api/admin/new-visa-countries/${config.id}`, { active: !config.active });
      toast.success(updated.active ? `${updated.country.name} enabled.` : `${updated.country.name} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this country. Please try again.");
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    const reason = await confirm({
      title: `Remove ${config.country.name} from New Visa?`,
      description: "This permanently deletes this country's New Visa configuration. To take it offline temporarily, disable it instead.",
      confirmLabel: "Remove Country",
    });
    if (!reason) return;
    setDeleting(true);
    try {
      await deleteJson(withReasonQuery(`/api/admin/new-visa-countries/${config.id}`, reason));
      toast.success(`${config.country.name} removed.`);
      onDeleted(config.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove this country. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-heading">
            {config.country.name} ({config.country.code}) · {config.stayDays ? `${config.stayDays} Days` : config.duration} ·{" "}
            {config.entryKind ? (config.entryKind === "SINGLE" ? "Single Entry" : "Multiple Entry") : config.entryType}
          </span>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", config.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
            {config.active ? "Active" : "Disabled"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggle()} isLoading={toggling}>
            {config.active ? "Disable" : "Enable"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleDelete()} isLoading={deleting}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Remove
          </Button>
          {dialog}
        </div>
      </div>
      <ConfigFields idPrefix={`new-visa-${config.id}`} form={form} onChange={setForm} errors={errors} disabled={saving} />
      <ReferencePanel countryId={config.countryId} reference={reference} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewConfigForm({
  availableCountries,
  onCreated,
  defaultCountryId,
}: {
  availableCountries: CountryData[];
  onCreated: (c: ConfigData) => void;
  defaultCountryId?: string;
}) {
  const [countryId, setCountryId] = useState(defaultCountryId ?? "");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<ConfigData>("/api/admin/new-visa-countries", { countryId, ...toPayload(form) });
      toast.success(`${created.country.name} added.`);
      onCreated(created);
      setCountryId(defaultCountryId ?? "");
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this country. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit =
    !!countryId &&
    form.visaCategory.trim() !== "" &&
    form.stayDays !== "" &&
    form.entryKind !== "" &&
    form.processingType.trim() !== "" &&
    form.description.trim() !== "" &&
    form.termsAndConditions.trim() !== "";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Add New Visa Product</h2>
      <SelectField
        label="Country"
        name="new-visa-new-countryId"
        placeholder={availableCountries.length ? "Select a country" : "No active countries"}
        options={availableCountries.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
        value={countryId}
        onChange={(event) => setCountryId(event.target.value)}
        error={errors.countryId?.[0]}
        disabled={creating || availableCountries.length === 0}
      />
      <ConfigFields idPrefix="new-visa-new" form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Country
        </Button>
      </div>
    </div>
  );
}

/**
 * Step 43 (Admin FINAL handover §7). "Connects to" Pricing (Step 40) /
 * Documents (Step 41) / Timeline (Step 42) by fetching their existing
 * admin lists once and filtering client-side for NEW_VISA + this country
 * (ReferencePanel) — never duplicates their data into this screen's own
 * writes. All four of these routes share the same masters.manage gate this
 * screen is under, so a session that can reach this page can always read
 * them too.
 */
/**
 * P23 — optional `countryId` (Service Configuration hub) narrows the list to
 * that country's products and pre-selects it on the add form. Absent = every
 * country, as before.
 */
export function NewVisaCountriesManager({ countryId }: { countryId?: string } = {}) {
  const [state, setState] = useState<FetchState>("loading");
  const [configs, setConfigs] = useState<ConfigData[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [reference, setReference] = useState<ReferenceData>({ pricingRules: [], documentRequirements: [], newVisaTimeline: null });
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [stayFilter, setStayFilter] = useState("");
  const [entryFilter, setEntryFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const visibleConfigs = countryId ? configs.filter((config) => config.countryId === countryId) : configs;
  const query = search.trim().toLowerCase();
  const filtered = visibleConfigs.filter((config) => {
    if (stayFilter && String(config.stayDays ?? "") !== stayFilter) return false;
    if (entryFilter && config.entryKind !== entryFilter) return false;
    if (activeFilter === "active" && !config.active) return false;
    if (activeFilter === "inactive" && config.active) return false;
    if (!query) return true;
    return [config.country.name, config.country.code, config.visaCategory, config.duration, config.entryType, config.processingType]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);
  const hasFilters = query !== "" || stayFilter !== "" || entryFilter !== "" || activeFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStayFilter("");
    setEntryFilter("");
    setActiveFilter("all");
    resetPage();
  };
  const filterClass = cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[140px]");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [configList, countryList, pricingRules, documentRequirements, timelines] = await Promise.all([
          getJson<ConfigData[]>("/api/admin/new-visa-countries"),
          getJson<CountryData[]>("/api/admin/countries"),
          getJson<PricingRuleData[]>("/api/admin/pricing-rules"),
          getJson<DocumentRequirementData[]>("/api/admin/document-requirements"),
          getJson<TimelineData[]>("/api/admin/service-timelines"),
        ]);
        if (cancelled) return;
        setConfigs(configList);
        setCountries(countryList);
        setReference({
          pricingRules,
          documentRequirements,
          newVisaTimeline: timelines.find((t) => t.serviceType === "NEW_VISA") ?? null,
        });
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load New Visa countries. Please try again.");
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
          <Skeleton key={index} className="h-64 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load New Visa countries"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  // P10 — a country can have several products (stay duration x entry type).
  const availableCountries = countries.filter((c) => c.active);

  return (
    <div className="flex flex-col gap-4">
      {visibleConfigs.length === 0 ? (
        <EmptyState
          title={countryId ? "No New Visa products for this country yet" : "No New Visa countries yet"}
          description={countryId ? "Add the first product for this country using the form below." : "Add the first country using the form below."}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
              <label htmlFor="new-visa-product-search" className="sr-only">
                Search New Visa products
              </label>
              <input
                id="new-visa-product-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Search by country, code or visa category…"
                className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
              />
            </div>
            <label htmlFor="new-visa-product-filter-stay" className="sr-only">
              Filter by stay duration
            </label>
            <select
              id="new-visa-product-filter-stay"
              value={stayFilter}
              onChange={(event) => {
                setStayFilter(event.target.value);
                resetPage();
              }}
              className={filterClass}
            >
              <option value="">All durations</option>
              <option value="30">30 Days</option>
              <option value="60">60 Days</option>
            </select>
            <label htmlFor="new-visa-product-filter-entry" className="sr-only">
              Filter by entry type
            </label>
            <select
              id="new-visa-product-filter-entry"
              value={entryFilter}
              onChange={(event) => {
                setEntryFilter(event.target.value);
                resetPage();
              }}
              className={filterClass}
            >
              <option value="">All entry types</option>
              <option value="SINGLE">Single Entry</option>
              <option value="MULTIPLE">Multiple Entry</option>
            </select>
            <label htmlFor="new-visa-product-filter-active" className="sr-only">
              Filter by status
            </label>
            <select
              id="new-visa-product-filter-active"
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
              title="No New Visa products match these filters"
              description={`None of the ${visibleConfigs.length} products match. Try a different search term or clear the filters.`}
              action={
                <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              {pageItems.map((config) => (
                <ConfigCard
                  key={config.id}
                  config={config}
                  reference={reference}
                  onSaved={(updated) => setConfigs((current) => current.map((c) => (c.id === updated.id ? updated : c)))}
                  onDeleted={(id) => setConfigs((current) => current.filter((c) => c.id !== id))}
                />
              ))}
              <ListPagination noun="New Visa product" {...paginationProps} />
            </>
          )}
        </>
      )}
      <NewConfigForm
        key={countryId ?? ""}
        availableCountries={availableCountries}
        defaultCountryId={countryId}
        onCreated={(created) => setConfigs((current) => [...current, created])} />
    </div>
  );
}
