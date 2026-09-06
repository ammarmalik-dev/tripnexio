"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

interface DocumentRequirementData {
  id: string;
  nationality: string;
  serviceType: ServiceType;
  documentName: string;
  required: boolean;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  nationality: string;
  serviceType: ServiceType | "";
  documentName: string;
  required: boolean;
}

const EMPTY_FORM: FormState = { nationality: "", serviceType: "", documentName: "", required: true };

function toFormState(item: DocumentRequirementData): FormState {
  return { nationality: item.nationality, serviceType: item.serviceType, documentName: item.documentName, required: item.required };
}

function RequirementFields({
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
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField
        label="Nationality"
        name="nationality"
        value={form.nationality}
        onChange={(event) => onChange({ ...form, nationality: event.target.value })}
        error={errors.nationality?.[0]}
        disabled={disabled}
      />
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
    nationality: form.nationality.trim(),
    serviceType: form.serviceType || undefined,
    documentName: form.documentName.trim(),
    required: form.required,
  };
}

function RequirementCard({ item, onSaved }: { item: DocumentRequirementData; onSaved: (item: DocumentRequirementData) => void }) {
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
      <RequirementFields form={form} onChange={setForm} errors={errors} disabled={saving} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewRequirementForm({ onCreated }: { onCreated: (item: DocumentRequirementData) => void }) {
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

  const canSubmit = form.nationality.trim() && form.serviceType && form.documentName.trim();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Document Requirement</h2>
      <RequirementFields form={form} onChange={setForm} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Requirement
        </Button>
      </div>
    </div>
  );
}

export function DocumentRequirementsManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<DocumentRequirementData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<DocumentRequirementData[]>("/api/admin/document-requirements");
        if (cancelled) return;
        setItems(result);
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
      {items.length === 0 ? (
        <EmptyState title="No document requirements yet" description="Add the first one using the form below." />
      ) : (
        items.map((item) => (
          <RequirementCard
            key={item.id}
            item={item}
            onSaved={(updated) => setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
          />
        ))
      )}
      <NewRequirementForm onCreated={(created) => setItems((current) => [...current, created])} />
    </div>
  );
}
