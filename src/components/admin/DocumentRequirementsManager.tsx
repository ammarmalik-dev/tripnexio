"use client";

import { useEffect, useState } from "react";
import { Plus, Copy, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_OPTIONS, SERVICE_TYPE_LABELS, PAX_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType, PaxType } from "../../generated/prisma/enums";
import { NationalitySelect, nationalityFormValue, nationalityPayload } from "./NationalitySelect";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

const PAX_TYPE_OPTIONS = (Object.entries(PAX_TYPE_LABELS) as [PaxType, string][]).map(([value, label]) => ({ value, label }));

interface CountryData {
  id: string;
  name: string;
  active: boolean;
}

interface DocumentRequirementData {
  id: string;
  serviceType: ServiceType;
  countryId: string | null;
  country: { id: string; name: string; code: string } | null;
  nationality: string | null;
  nationalityId: string | null;
  paxType: PaxType | null;
  documentName: string;
  documentTypeId: string | null;
  required: boolean;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";
type ActiveFilter = "all" | "active" | "inactive";
type RequiredFilter = "all" | "required" | "optional";
/** Country filter value for the all-countries (not country-specific) rows. */
const NO_COUNTRY = "__none";

interface FormState {
  serviceType: ServiceType | "";
  countryId: string;
  nationality: string;
  paxType: PaxType | "";
  /** Client corrections 2026-10-05 — picked from the Document Master. */
  documentTypeId: string;
  required: boolean;
}

const EMPTY_FORM: FormState = { serviceType: "", countryId: "", nationality: "", paxType: "", documentTypeId: "", required: true };

interface DocumentTypeOption {
  id: string;
  name: string;
  defaultMandatory: boolean;
  active: boolean;
}

/** The Document Master list (Admin → Document Master), loaded once per screen. */
function useDocumentTypes(): DocumentTypeOption[] {
  const [types, setTypes] = useState<DocumentTypeOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await getJson<DocumentTypeOption[]>("/api/admin/document-types");
        if (!cancelled) setTypes(rows);
      } catch {
        // The select stays empty; the save then reports the missing document.
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);
  return types;
}

function toFormState(item: DocumentRequirementData): FormState {
  return {
    serviceType: item.serviceType,
    countryId: item.countryId ?? "",
    nationality: nationalityFormValue(item),
    paxType: item.paxType ?? "",
    documentTypeId: item.documentTypeId ?? "",
    required: item.required,
  };
}

function RequirementFields({
  idPrefix,
  form,
  onChange,
  errors,
  disabled,
  countries,
  currentNationalityName,
}: {
  /** Keeps control ids unique when several cards are on screen at once. */
  idPrefix: string;
  form: FormState;
  onChange: (next: FormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
  countries: CountryData[];
  currentNationalityName?: string | null;
}) {
  const id = (field: string) => `${idPrefix}-${field}`;
  const documentTypes = useDocumentTypes();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Service" htmlFor={id("serviceType")} error={errors.serviceType?.[0]}>
        <select
          id={id("serviceType")}
          value={form.serviceType}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, serviceType: event.target.value as ServiceType })}
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
      <SelectField
        label="Country"
        name={id("countryId")}
        placeholder="All countries (not country-specific)"
        options={countries.map((c) => ({ value: c.id, label: c.name }))}
        value={form.countryId}
        onChange={(event) => onChange({ ...form, countryId: event.target.value })}
        error={errors.countryId?.[0]}
        disabled={disabled}
        hint="Optional — the destination country, distinct from nationality below."
      />
      <NationalitySelect
        id={id("nationality")}
        value={form.nationality}
        onChange={(value) => onChange({ ...form, nationality: value })}
        currentName={currentNationalityName}
        error={errors.nationalityId?.[0] ?? errors.nationality?.[0]}
        disabled={disabled}
        hint="Optional — the applicant's own nationality."
      />
      <FormField label="Passenger Type" htmlFor={id("paxType")} error={errors.paxType?.[0]}>
        <select
          id={id("paxType")}
          value={form.paxType}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, paxType: event.target.value as PaxType })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.paxType))}
        >
          <option value="">Any passenger type</option>
          {PAX_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <SelectField
        label="Document"
        name={id("documentTypeId")}
        placeholder="Select from the Document Master"
        options={documentTypes
          .filter((type) => type.active || type.id === form.documentTypeId)
          .map((type) => ({ value: type.id, label: type.name }))}
        value={form.documentTypeId}
        onChange={(event) => {
          const picked = documentTypes.find((type) => type.id === event.target.value);
          onChange({ ...form, documentTypeId: event.target.value, required: picked ? picked.defaultMandatory : form.required });
        }}
        error={errors.documentTypeId?.[0] ?? errors.documentName?.[0]}
        disabled={disabled}
        hint="Missing a document? Add it in Admin → Document Master."
      />
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={form.required}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, required: event.target.checked })}
        />
        Mandatory (unchecked = optional)
      </label>
    </div>
  );
}

function buildPayload(form: FormState) {
  return {
    serviceType: form.serviceType || undefined,
    countryId: form.countryId === "" ? undefined : form.countryId,
    nationalityId: nationalityPayload(form.nationality),
    paxType: form.paxType === "" ? undefined : form.paxType,
    documentTypeId: form.documentTypeId || undefined,
    required: form.required,
  };
}

function RequirementCard({
  item,
  countries,
  onSaved,
}: {
  item: DocumentRequirementData;
  countries: CountryData[];
  onSaved: (item: DocumentRequirementData) => void;
}) {
  const { confirm, dialog } = useConfirmAction();
  const [form, setForm] = useState<FormState>(toFormState(item));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(item));

  const handleSave = async () => {
    const reason = await confirm({
      title: `Update document requirement "${item.documentName}"?`,
      description: "This changes the document checklist customers and staff see for new requests.",
      confirmLabel: "Save Changes",
    });
    if (!reason) return;
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<DocumentRequirementData>(`/api/admin/document-requirements/${item.id}`, { ...buildPayload(form), reason });
      toast.success(`Document requirement "${updated.documentName}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this requirement. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const reason = await confirm({
      title: `${item.active ? "Disable" : "Enable"} document requirement "${item.documentName}"?`,
      description: item.active ? "This document will no longer be requested on new applications." : "This document will be requested on new applications again.",
      confirmLabel: item.active ? "Disable" : "Enable",
    });
    if (!reason) return;
    setTogglingActive(true);
    try {
      const updated = await patchJson<DocumentRequirementData>(`/api/admin/document-requirements/${item.id}`, { active: !item.active, reason });
      toast.success(updated.active ? "Enabled." : "Disabled.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this requirement. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn("rounded-full px-2.5 py-1 text-xs font-medium", item.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}
        >
          {item.active ? "Active" : "Disabled"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {item.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <RequirementFields
        idPrefix={`requirement-${item.id}`}
        form={form}
        onChange={setForm}
        errors={errors}
        disabled={saving}
        countries={countries}
        currentNationalityName={item.nationality}
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
      {dialog}
    </div>
  );
}

function NewRequirementForm({
  countries,
  onCreated,
  defaults,
}: {
  countries: CountryData[];
  onCreated: (item: DocumentRequirementData) => void;
  /** P23 — Service Configuration hub pre-fill (service/country). Absent = the original empty form. */
  defaults?: Partial<Pick<FormState, "serviceType" | "countryId">>;
}) {
  const { confirm, dialog } = useConfirmAction();
  const initialForm: FormState = { ...EMPTY_FORM, ...defaults };
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const reason = await confirm({
      title: "Add this document requirement?",
      description: "This adds a document to the checklist customers and staff see for new requests.",
      confirmLabel: "Add Requirement",
    });
    if (!reason) return;
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<DocumentRequirementData>("/api/admin/document-requirements", { ...buildPayload(form), reason });
      toast.success(`Document requirement "${created.documentName}" added.`);
      onCreated(created);
      setForm(initialForm);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this requirement. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.serviceType && form.documentTypeId;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Document Requirement</h2>
      <RequirementFields idPrefix="new-requirement" form={form} onChange={setForm} errors={errors} disabled={creating} countries={countries} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Requirement
        </Button>
      </div>
      {dialog}
    </div>
  );
}

/**
 * Step 41 (Admin FINAL handover §5): "Allow one-click/bulk application of
 * the same checklist to multiple services where applicable." Source is one
 * exact (service, country, nationality, passenger type) combination —
 * Preview shows exactly what's stored under it before anything is copied.
 * A target service that already has an identical document is skipped for
 * that one, never overwritten.
 */
function BulkApplyPanel({
  countries,
  defaultServiceType,
  defaultCountryId,
}: {
  countries: CountryData[];
  defaultServiceType?: ServiceType;
  defaultCountryId?: string;
}) {
  const { confirm, dialog } = useConfirmAction();
  const [sourceServiceType, setSourceServiceType] = useState<ServiceType | "">(defaultServiceType ?? "");
  const [sourceCountryId, setSourceCountryId] = useState(defaultCountryId ?? "");
  const [sourceNationality, setSourceNationality] = useState("");
  const [sourcePaxType, setSourcePaxType] = useState<PaxType | "">("");
  const [preview, setPreview] = useState<DocumentRequirementData[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [targets, setTargets] = useState<Set<ServiceType>>(new Set());
  const [applying, setApplying] = useState(false);

  const handlePreview = async () => {
    if (!sourceServiceType) return;
    setPreviewing(true);
    setPreview(null);
    try {
      const params = new URLSearchParams({ serviceType: sourceServiceType });
      if (sourceCountryId) params.set("countryId", sourceCountryId);
      if (sourceNationality.trim()) params.set("nationality", sourceNationality.trim());
      if (sourcePaxType) params.set("paxType", sourcePaxType);
      const rows = await getJson<DocumentRequirementData[]>(`/api/admin/document-requirements/bulk-apply?${params.toString()}`);
      setPreview(rows);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't load this checklist. Please try again.");
    } finally {
      setPreviewing(false);
    }
  };

  const toggleTarget = (service: ServiceType) => {
    setTargets((current) => {
      const next = new Set(current);
      if (next.has(service)) next.delete(service);
      else next.add(service);
      return next;
    });
  };

  const handleApply = async () => {
    const reason = await confirm({
      title: "Bulk-apply document checklist?",
      description: `This copies the previewed document requirements onto ${targets.size} service(s): ${[...targets].join(", ")}.`,
      confirmLabel: "Apply Checklist",
    });
    if (!reason) return;
    setApplying(true);
    try {
      const result = await postJson<{ copiedByService: Record<string, number> }>("/api/admin/document-requirements/bulk-apply", {
        sourceServiceType,
        sourceCountryId: sourceCountryId || undefined,
        sourceNationality: sourceNationality.trim() || undefined,
        sourcePaxType: sourcePaxType || undefined,
        targetServiceTypes: [...targets],
        reason,
      });
      const summary = Object.entries(result.copiedByService)
        .map(([service, count]) => `${service}: ${count}`)
        .join(", ");
      toast.success(`Applied — ${summary}`);
      setTargets(new Set());
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't apply this checklist. Please try again.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-2 p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-heading">
        <Copy className="h-4 w-4" aria-hidden="true" />
        Bulk Apply Checklist
      </h2>
      <p className="text-xs text-ink-tertiary">
        Copy every document requirement matching one exact source combination onto one or more other services.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Source Service" htmlFor="bulk-source-service">
          <select
            id="bulk-source-service"
            value={sourceServiceType}
            onChange={(event) => {
              setSourceServiceType(event.target.value as ServiceType);
              setPreview(null);
            }}
            className={cn(fieldControlClass, fieldBorderClass(false))}
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
        <SelectField
          label="Source Country"
          name="bulk-source-country"
          placeholder="All countries"
          options={countries.map((c) => ({ value: c.id, label: c.name }))}
          value={sourceCountryId}
          onChange={(event) => {
            setSourceCountryId(event.target.value);
            setPreview(null);
          }}
        />
        <TextField
          label="Source Nationality"
          name="bulk-source-nationality"
          placeholder="All nationalities"
          value={sourceNationality}
          onChange={(event) => {
            setSourceNationality(event.target.value);
            setPreview(null);
          }}
        />
        <FormField label="Source Passenger Type" htmlFor="bulk-source-paxtype">
          <select
            id="bulk-source-paxtype"
            value={sourcePaxType}
            onChange={(event) => {
              setSourcePaxType(event.target.value as PaxType);
              setPreview(null);
            }}
            className={cn(fieldControlClass, fieldBorderClass(false))}
          >
            <option value="">Any passenger type</option>
            {PAX_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handlePreview()} isLoading={previewing} disabled={!sourceServiceType}>
          Preview Checklist
        </Button>
      </div>
      {preview ? (
        preview.length === 0 ? (
          <p className="text-xs text-ink-tertiary">No document requirements match this exact combination.</p>
        ) : (
          <div className="rounded-lg border border-hairline bg-surface-1 p-3">
            <p className="mb-1.5 text-xs font-medium text-ink-secondary">{preview.length} document(s) will be copied:</p>
            <ul className="flex flex-wrap gap-1.5">
              {preview.map((row) => (
                <li key={row.id} className="rounded-full bg-ink-primary/[0.06] px-2.5 py-1 text-xs text-ink-secondary">
                  {row.documentName}
                  {!row.required ? " (optional)" : ""}
                </li>
              ))}
            </ul>
          </div>
        )
      ) : null}
      {preview && preview.length > 0 ? (
        <>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-primary">Apply To</span>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SERVICE_TYPE_OPTIONS.filter((option) => option.value !== sourceServiceType).map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-ink-secondary">
                  <input type="checkbox" checked={targets.has(option.value)} onChange={() => toggleTarget(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" onClick={() => void handleApply()} isLoading={applying} disabled={targets.size === 0}>
              <Copy className="h-4 w-4" aria-hidden="true" />
              Apply to {targets.size || ""} Service{targets.size === 1 ? "" : "s"}
            </Button>
          </div>
        </>
      ) : null}
      {dialog}
    </div>
  );
}

/**
 * P23 — optional Service Configuration hub scoping. `serviceType` narrows the
 * list to that service; `countryId` narrows it to that country's rules plus
 * the all-countries (null) ones that also apply there. Both also pre-fill the
 * new-requirement form and the Bulk Apply source. Absent = original behaviour.
 */
export function DocumentRequirementsManager({ serviceType, countryId }: { serviceType?: ServiceType; countryId?: string } = {}) {
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<DocumentRequirementData[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<ServiceType | "">("");
  const [countryFilter, setCountryFilter] = useState("");
  const [paxFilter, setPaxFilter] = useState<PaxType | "">("");
  const [requiredFilter, setRequiredFilter] = useState<RequiredFilter>("all");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  // Hub scoping first (service / country props), then the toolbar filters.
  const visibleItems = items.filter(
    (item) =>
      (!serviceType || item.serviceType === serviceType) &&
      (!countryId || item.countryId === countryId || item.countryId === null),
  );
  const query = search.trim().toLowerCase();
  const filtered = visibleItems.filter((item) => {
    if (serviceFilter && item.serviceType !== serviceFilter) return false;
    if (countryFilter === NO_COUNTRY ? item.countryId !== null : countryFilter !== "" && item.countryId !== countryFilter) return false;
    if (paxFilter && item.paxType !== paxFilter) return false;
    if (requiredFilter === "required" && !item.required) return false;
    if (requiredFilter === "optional" && item.required) return false;
    if (activeFilter === "active" && !item.active) return false;
    if (activeFilter === "inactive" && item.active) return false;
    if (!query) return true;
    return [item.documentName, item.country?.name, item.country?.code, item.nationality, SERVICE_TYPE_LABELS[item.serviceType]]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);
  const hasFilters =
    query !== "" || serviceFilter !== "" || countryFilter !== "" || paxFilter !== "" || requiredFilter !== "all" || activeFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setServiceFilter("");
    setCountryFilter("");
    setPaxFilter("");
    setRequiredFilter("all");
    setActiveFilter("all");
    resetPage();
  };
  const filterClass = cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[150px]");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const [itemList, countryList] = await Promise.all([
          getJson<DocumentRequirementData[]>("/api/admin/document-requirements"),
          getJson<CountryData[]>("/api/admin/countries"),
        ]);
        if (cancelled) return;
        setItems(itemList);
        setCountries(countryList.filter((c) => c.active));
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load document requirements. Please try again.");
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
        title="Couldn't load document requirements"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const formDefaults = { ...(serviceType ? { serviceType } : {}), ...(countryId ? { countryId } : {}) };

  return (
    <div className="flex flex-col gap-4">
      <BulkApplyPanel countries={countries} defaultServiceType={serviceType} defaultCountryId={countryId} />
      {visibleItems.length === 0 ? (
        <EmptyState title="No document requirements yet" description="Add the first one using the form below." />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
              <label htmlFor="document-requirement-search" className="sr-only">
                Search document requirements
              </label>
              <input
                id="document-requirement-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="Search by document, country or nationality…"
                className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
              />
            </div>
            {serviceType ? null : (
              <>
                <label htmlFor="document-requirement-filter-service" className="sr-only">
                  Filter by service
                </label>
                <select
                  id="document-requirement-filter-service"
                  value={serviceFilter}
                  onChange={(event) => {
                    setServiceFilter(event.target.value as ServiceType | "");
                    resetPage();
                  }}
                  className={filterClass}
                >
                  <option value="">All services</option>
                  {SERVICE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label htmlFor="document-requirement-filter-country" className="sr-only">
              Filter by country
            </label>
            <select
              id="document-requirement-filter-country"
              value={countryFilter}
              onChange={(event) => {
                setCountryFilter(event.target.value);
                resetPage();
              }}
              className={filterClass}
            >
              <option value="">All countries</option>
              <option value={NO_COUNTRY}>Not country-specific</option>
              {countries
                .filter((entry) => !countryId || entry.id === countryId)
                .map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
            </select>
            <label htmlFor="document-requirement-filter-pax" className="sr-only">
              Filter by passenger type
            </label>
            <select
              id="document-requirement-filter-pax"
              value={paxFilter}
              onChange={(event) => {
                setPaxFilter(event.target.value as PaxType | "");
                resetPage();
              }}
              className={filterClass}
            >
              <option value="">All passenger types</option>
              {PAX_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label htmlFor="document-requirement-filter-required" className="sr-only">
              Filter by required or optional
            </label>
            <select
              id="document-requirement-filter-required"
              value={requiredFilter}
              onChange={(event) => {
                setRequiredFilter(event.target.value as RequiredFilter);
                resetPage();
              }}
              className={filterClass}
            >
              <option value="all">Required &amp; optional</option>
              <option value="required">Required only</option>
              <option value="optional">Optional only</option>
            </select>
            <label htmlFor="document-requirement-filter-active" className="sr-only">
              Filter by status
            </label>
            <select
              id="document-requirement-filter-active"
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
              title="No document requirements match these filters"
              description={`None of the ${visibleItems.length} document requirements match. Try a different search term or clear the filters.`}
              action={
                <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              {pageItems.map((item) => (
                <RequirementCard
                  key={item.id}
                  item={item}
                  countries={countries}
                  onSaved={(updated) => setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
                />
              ))}
              <ListPagination noun="document requirement" {...paginationProps} />
            </>
          )}
        </>
      )}
      <NewRequirementForm
        key={`${serviceType ?? ""}-${countryId ?? ""}`}
        countries={countries}
        defaults={formDefaults}
        onCreated={(created) => setItems((current) => [...current, created])}
      />
    </div>
  );
}
