"use client";

import { useEffect, useState } from "react";
import { Plus, Copy } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_OPTIONS, PAX_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType, PaxType } from "../../generated/prisma/enums";

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
  paxType: PaxType | null;
  documentName: string;
  required: boolean;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  serviceType: ServiceType | "";
  countryId: string;
  nationality: string;
  paxType: PaxType | "";
  documentName: string;
  required: boolean;
}

const EMPTY_FORM: FormState = { serviceType: "", countryId: "", nationality: "", paxType: "", documentName: "", required: true };

function toFormState(item: DocumentRequirementData): FormState {
  return {
    serviceType: item.serviceType,
    countryId: item.countryId ?? "",
    nationality: item.nationality ?? "",
    paxType: item.paxType ?? "",
    documentName: item.documentName,
    required: item.required,
  };
}

function RequirementFields({
  form,
  onChange,
  errors,
  disabled,
  countries,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
  countries: CountryData[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Service" htmlFor="serviceType" error={errors.serviceType?.[0]}>
        <select
          id="serviceType"
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
        name="countryId"
        placeholder="All countries (not country-specific)"
        options={countries.map((c) => ({ value: c.id, label: c.name }))}
        value={form.countryId}
        onChange={(event) => onChange({ ...form, countryId: event.target.value })}
        error={errors.countryId?.[0]}
        disabled={disabled}
        hint="Optional — the destination GCC country, distinct from nationality below."
      />
      <TextField
        label="Nationality"
        name="nationality"
        placeholder="Leave blank to apply to all nationalities"
        value={form.nationality}
        onChange={(event) => onChange({ ...form, nationality: event.target.value })}
        error={errors.nationality?.[0]}
        disabled={disabled}
        hint="Optional — the applicant's own nationality."
      />
      <FormField label="Passenger Type" htmlFor="paxType" error={errors.paxType?.[0]}>
        <select
          id="paxType"
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
      <TextField
        label="Document Name"
        name="documentName"
        placeholder="e.g. Passport Copy"
        value={form.documentName}
        onChange={(event) => onChange({ ...form, documentName: event.target.value })}
        error={errors.documentName?.[0]}
        disabled={disabled}
      />
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input
          type="checkbox"
          checked={form.required}
          disabled={disabled}
          onChange={(event) => onChange({ ...form, required: event.target.checked })}
        />
        Required (unchecked = optional)
      </label>
    </div>
  );
}

function buildPayload(form: FormState) {
  return {
    serviceType: form.serviceType || undefined,
    countryId: form.countryId === "" ? undefined : form.countryId,
    nationality: form.nationality.trim() === "" ? undefined : form.nationality.trim(),
    paxType: form.paxType === "" ? undefined : form.paxType,
    documentName: form.documentName.trim(),
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
  const [form, setForm] = useState<FormState>(toFormState(item));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(item));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<DocumentRequirementData>(`/api/admin/document-requirements/${item.id}`, buildPayload(form));
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
    setTogglingActive(true);
    try {
      const updated = await patchJson<DocumentRequirementData>(`/api/admin/document-requirements/${item.id}`, { active: !item.active });
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
      <RequirementFields form={form} onChange={setForm} errors={errors} disabled={saving} countries={countries} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewRequirementForm({ countries, onCreated }: { countries: CountryData[]; onCreated: (item: DocumentRequirementData) => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<DocumentRequirementData>("/api/admin/document-requirements", buildPayload(form));
      toast.success(`Document requirement "${created.documentName}" added.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this requirement. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.serviceType && form.documentName.trim();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Document Requirement</h2>
      <RequirementFields form={form} onChange={setForm} errors={errors} disabled={creating} countries={countries} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Requirement
        </Button>
      </div>
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
function BulkApplyPanel({ countries }: { countries: CountryData[] }) {
  const [sourceServiceType, setSourceServiceType] = useState<ServiceType | "">("");
  const [sourceCountryId, setSourceCountryId] = useState("");
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
    setApplying(true);
    try {
      const result = await postJson<{ copiedByService: Record<string, number> }>("/api/admin/document-requirements/bulk-apply", {
        sourceServiceType,
        sourceCountryId: sourceCountryId || undefined,
        sourceNationality: sourceNationality.trim() || undefined,
        sourcePaxType: sourcePaxType || undefined,
        targetServiceTypes: [...targets],
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
    </div>
  );
}

export function DocumentRequirementsManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<DocumentRequirementData[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

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

  return (
    <div className="flex flex-col gap-4">
      <BulkApplyPanel countries={countries} />
      {items.length === 0 ? (
        <EmptyState title="No document requirements yet" description="Add the first one using the form below." />
      ) : (
        items.map((item) => (
          <RequirementCard
            key={item.id}
            item={item}
            countries={countries}
            onSaved={(updated) => setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewRequirementForm countries={countries} onCreated={(created) => setItems((current) => [...current, created])} />
    </div>
  );
}
