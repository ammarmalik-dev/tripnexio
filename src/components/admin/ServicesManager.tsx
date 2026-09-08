"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { Textarea } from "@/components/forms/Textarea";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { SERVICE_ICON_MAP, SERVICE_ICON_OPTIONS } from "@/lib/service-icons";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

interface ServiceData {
  id: string;
  code: ServiceType;
  name: string;
  shortDescription: string;
  iconName: string;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface ServiceFormState {
  code: ServiceType | "";
  name: string;
  shortDescription: string;
  iconName: string;
  displayOrder: string;
}

const EMPTY_FORM: ServiceFormState = {
  code: "",
  name: "",
  shortDescription: "",
  iconName: SERVICE_ICON_OPTIONS[0],
  displayOrder: "0",
};

function toFormState(service: ServiceData): ServiceFormState {
  return {
    code: service.code,
    name: service.name,
    shortDescription: service.shortDescription,
    iconName: service.iconName,
    displayOrder: String(service.displayOrder),
  };
}

function IconPreview({ iconName }: { iconName: string }) {
  const Icon = SERVICE_ICON_MAP[iconName];
  if (!Icon) return null;
  return <Icon className="h-4 w-4" aria-hidden="true" />;
}

function ServiceFields({
  form,
  onChange,
  errors,
  disabled,
  codeLocked,
}: {
  form: ServiceFormState;
  onChange: (next: ServiceFormState) => void;
  errors: Record<string, string[] | undefined>;
  disabled: boolean;
  codeLocked: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Service" htmlFor="code" error={errors.code?.[0]}>
        <select
          id="code"
          value={form.code}
          disabled={disabled || codeLocked}
          onChange={(event) => onChange({ ...form, code: event.target.value as ServiceType })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.code))}
        >
          <option value="" disabled>
            Select a service
          </option>
          {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label} ({value})
            </option>
          ))}
        </select>
      </FormField>
      <TextField
        label="Display Name"
        name="name"
        value={form.name}
        onChange={(event) => onChange({ ...form, name: event.target.value })}
        error={errors.name?.[0]}
        disabled={disabled}
      />
      <div className="sm:col-span-2">
        <Textarea
          label="Short Description"
          name="shortDescription"
          value={form.shortDescription}
          onChange={(event) => onChange({ ...form, shortDescription: event.target.value })}
          error={errors.shortDescription?.[0]}
          disabled={disabled}
          rows={2}
        />
      </div>
      <FormField label="Icon" htmlFor="iconName" error={errors.iconName?.[0]}>
        <div className="flex items-center gap-2">
          <select
            id="iconName"
            value={form.iconName}
            disabled={disabled}
            onChange={(event) => onChange({ ...form, iconName: event.target.value })}
            className={cn(fieldControlClass, fieldBorderClass(!!errors.iconName))}
          >
            {SERVICE_ICON_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <IconPreview iconName={form.iconName} />
        </div>
      </FormField>
      <TextField
        label="Display Order"
        name="displayOrder"
        type="number"
        value={form.displayOrder}
        onChange={(event) => onChange({ ...form, displayOrder: event.target.value })}
        error={errors.displayOrder?.[0]}
        disabled={disabled}
      />
    </div>
  );
}

function buildPayload(form: ServiceFormState) {
  return {
    code: form.code || undefined,
    name: form.name.trim(),
    shortDescription: form.shortDescription.trim(),
    iconName: form.iconName,
    displayOrder: Number(form.displayOrder) || 0,
  };
}

function ServiceCard({ service, onSaved }: { service: ServiceData; onSaved: (service: ServiceData) => void }) {
  const [form, setForm] = useState<ServiceFormState>(toFormState(service));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(service));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<ServiceData>(`/api/admin/services/${service.id}`, buildPayload(form));
      toast.success(`Service "${updated.name}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this service. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<ServiceData>(`/api/admin/services/${service.id}`, { active: !service.active });
      toast.success(
        updated.active ? `${updated.name} enabled — now visible on the website.` : `${updated.name} disabled — hidden from the website.`
      );
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this service. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-medium",
            service.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {service.active ? "Active — visible on website" : "Disabled — hidden from website"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {service.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <ServiceFields form={form} onChange={setForm} errors={errors} disabled={saving} codeLocked />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewServiceForm({ onCreated }: { onCreated: (service: ServiceData) => void }) {
  const [form, setForm] = useState<ServiceFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<ServiceData>("/api/admin/services", buildPayload(form));
      toast.success(`Service "${created.name}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this service. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = form.code && form.name.trim() && form.shortDescription.trim();

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Service Metadata Row</h2>
      <p className="text-xs text-ink-tertiary">
        Only for the 6 already-built services — a real request flow must already exist behind the selected service
        type for this to be meaningful.
      </p>
      <ServiceFields form={form} onChange={setForm} errors={errors} disabled={creating} codeLocked={false} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create
        </Button>
      </div>
    </div>
  );
}

export function ServicesManager() {
  const [state, setState] = useState<FetchState>("loading");
  const [services, setServices] = useState<ServiceData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState("loading");
      try {
        const result = await getJson<ServiceData[]>("/api/admin/services");
        if (cancelled) return;
        setServices(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load services. Please try again.");
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
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load services"
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
      {services.length === 0 ? (
        <EmptyState title="No service metadata yet" description="Add the first one using the form below." />
      ) : (
        services.map((service) => (
          <ServiceCard
            key={service.id}
            service={service}
            onSaved={(updated) => setServices((current) => current.map((s) => (s.id === updated.id ? updated : s)))}
          />
        ))
      )}
      <NewServiceForm onCreated={(created) => setServices((current) => [...current, created])} />
    </div>
  );
}
