"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { SelectField } from "@/components/forms/SelectField";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";

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

interface FormState {
  visaCategory: string;
  duration: string;
  processingType: string;
  description: string;
  termsAndConditions: string;
}

function toFormState(c: ConfigData): FormState {
  return {
    visaCategory: c.visaCategory,
    duration: c.duration,
    processingType: c.processingType,
    description: c.description,
    termsAndConditions: c.termsAndConditions,
  };
}

const EMPTY_FORM: FormState = { visaCategory: "", duration: "", processingType: "", description: "", termsAndConditions: "" };

function ConfigFields({
  form,
  onChange,
  errors,
  disabled,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  errors: FieldErrors;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Visa Category"
          name="visaCategory"
          placeholder="e.g. Tourist / Visit Visa"
          value={form.visaCategory}
          onChange={(event) => onChange({ ...form, visaCategory: event.target.value })}
          error={errors.visaCategory?.[0]}
          disabled={disabled}
        />
        <TextField
          label="Duration"
          name="duration"
          placeholder="e.g. 30 Days"
          value={form.duration}
          onChange={(event) => onChange({ ...form, duration: event.target.value })}
          error={errors.duration?.[0]}
          disabled={disabled}
        />
      </div>
      <TextField
        label="Processing Type"
        name="processingType"
        placeholder="e.g. Normal & Express available"
        value={form.processingType}
        onChange={(event) => onChange({ ...form, processingType: event.target.value })}
        error={errors.processingType?.[0]}
        disabled={disabled}
      />
      <Textarea
        label="Description"
        name="description"
        value={form.description}
        onChange={(event) => onChange({ ...form, description: event.target.value })}
        error={errors.description?.[0]}
        disabled={disabled}
      />
      <Textarea
        label="Terms & Conditions"
        name="termsAndConditions"
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
        <a href="/admin/pricing" className="text-ink-accent hover:underline">
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
        <a href="/admin/document-requirements" className="text-ink-accent hover:underline">
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
        <a href="/admin/timelines" className="text-ink-accent hover:underline">
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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(config));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<ConfigData>(`/api/admin/new-visa-countries/${config.id}`, form);
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
    setDeleting(true);
    try {
      await deleteJson(`/api/admin/new-visa-countries/${config.id}`);
      toast.success(`${config.country.name} removed.`);
      onDeleted(config.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove this country. Please try again.");
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-heading">
            {config.country.name} ({config.country.code})
          </span>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", config.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
            {config.active ? "Active" : "Disabled"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggle()} isLoading={toggling}>
            {config.active ? "Disable" : "Enable"}
          </Button>
          {confirmingDelete ? (
            <>
              <Button type="button" size="sm" variant="ghost" onClick={() => void handleDelete()} isLoading={deleting}>
                Confirm Remove
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </Button>
          )}
        </div>
      </div>
      <ConfigFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <ReferencePanel countryId={config.countryId} reference={reference} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewConfigForm({ availableCountries, onCreated }: { availableCountries: CountryData[]; onCreated: (c: ConfigData) => void }) {
  const [countryId, setCountryId] = useState("");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<ConfigData>("/api/admin/new-visa-countries", { countryId, ...form });
      toast.success(`${created.country.name} added.`);
      onCreated(created);
      setCountryId("");
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this country. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit =
    !!countryId && form.visaCategory.trim() !== "" && form.duration.trim() !== "" && form.processingType.trim() !== "" && form.description.trim() !== "" && form.termsAndConditions.trim() !== "";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">Add New Visa Country</h2>
      <SelectField
        label="Country"
        name="countryId"
        placeholder={availableCountries.length ? "Select a country" : "All countries already added"}
        options={availableCountries.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
        value={countryId}
        onChange={(event) => setCountryId(event.target.value)}
        error={errors.countryId?.[0]}
        disabled={creating || availableCountries.length === 0}
      />
      <ConfigFields form={form} onChange={setForm} errors={errors} disabled={creating} />
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
export function NewVisaCountriesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [configs, setConfigs] = useState<ConfigData[]>([]);
  const [countries, setCountries] = useState<CountryData[]>([]);
  const [reference, setReference] = useState<ReferenceData>({ pricingRules: [], documentRequirements: [], newVisaTimeline: null });
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

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

  const usedCountryIds = new Set(configs.map((c) => c.countryId));
  const availableCountries = countries.filter((c) => c.active && !usedCountryIds.has(c.id));

  return (
    <div className="flex flex-col gap-4">
      {configs.length === 0 ? (
        <EmptyState title="No New Visa countries yet" description="Add the first country using the form below." />
      ) : (
        configs.map((config) => (
          <ConfigCard
            key={config.id}
            config={config}
            reference={reference}
            onSaved={(updated) => setConfigs((current) => current.map((c) => (c.id === updated.id ? updated : c)))}
            onDeleted={(id) => setConfigs((current) => current.filter((c) => c.id !== id))}
          />
        ))
      )}
      <NewConfigForm availableCountries={availableCountries} onCreated={(created) => setConfigs((current) => [...current, created])} />
    </div>
  );
}
