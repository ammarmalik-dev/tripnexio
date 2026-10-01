"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, ApiError } from "@/lib/api/client";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

/**
 * P23 — shared editable-card manager for the two per-service option masters
 * (Sub-services, Processing Types). They differ only in the display field
 * (`name` vs `label`), whether `code` can be edited after creation, and copy —
 * so both public managers are thin configs over this one component.
 */
export interface ServiceOptionMasterConfig {
  apiPath: string;
  titleKey: "name" | "label";
  titleLabel: string;
  noun: string;
  nounPlural: string;
  codeEditable: boolean;
  codeHint: string;
  emptyDescription: string;
}

interface MasterRow {
  id: string;
  serviceType: ServiceType;
  code: string;
  name?: string;
  label?: string;
  description: string | null;
  displayOrder: number;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";
type FieldErrors = Record<string, string[] | undefined>;

interface FormState {
  serviceType: ServiceType | "";
  title: string;
  code: string;
  description: string;
  displayOrder: string;
}

function rowTitle(row: MasterRow, config: ServiceOptionMasterConfig): string {
  return row[config.titleKey] ?? "";
}

function toFormState(row: MasterRow, config: ServiceOptionMasterConfig): FormState {
  return {
    serviceType: row.serviceType,
    title: rowTitle(row, config),
    code: row.code,
    description: row.description ?? "",
    displayOrder: String(row.displayOrder),
  };
}

function ServiceSelect({
  id,
  label,
  value,
  onChange,
  includeAll,
  disabled,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: ServiceType | "") => void;
  includeAll?: boolean;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <FormField label={label} htmlFor={id} error={error}>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ServiceType | "")}
        className={cn(fieldControlClass, fieldBorderClass(!!error))}
      >
        <option value="">{includeAll ? "All services" : "Select a service"}</option>
        {SERVICE_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

function MasterFields({
  idPrefix,
  form,
  onChange,
  errors,
  disabled,
  config,
  codeLocked,
}: {
  idPrefix: string;
  form: FormState;
  onChange: (next: FormState) => void;
  errors: FieldErrors;
  disabled: boolean;
  config: ServiceOptionMasterConfig;
  codeLocked: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_100px]">
      <TextField
        label={config.titleLabel}
        name={`${idPrefix}-title`}
        value={form.title}
        onChange={(event) => onChange({ ...form, title: event.target.value })}
        error={errors[config.titleKey]?.[0]}
        disabled={disabled}
      />
      <TextField
        label="Code"
        name={`${idPrefix}-code`}
        value={form.code}
        onChange={(event) => onChange({ ...form, code: event.target.value.toLowerCase() })}
        error={errors.code?.[0]}
        hint={config.codeHint}
        disabled={disabled}
        readOnly={codeLocked}
        aria-readonly={codeLocked}
        className={codeLocked ? "cursor-not-allowed opacity-70" : undefined}
      />
      <TextField
        label="Order"
        name={`${idPrefix}-order`}
        type="number"
        value={form.displayOrder}
        onChange={(event) => onChange({ ...form, displayOrder: event.target.value })}
        error={errors.displayOrder?.[0]}
        disabled={disabled}
      />
      <div className="sm:col-span-3">
        <TextField
          label="Description (optional)"
          name={`${idPrefix}-description`}
          value={form.description}
          onChange={(event) => onChange({ ...form, description: event.target.value })}
          error={errors.description?.[0]}
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function MasterCard({
  row,
  config,
  showService,
  onSaved,
}: {
  row: MasterRow;
  config: ServiceOptionMasterConfig;
  showService: boolean;
  onSaved: (row: MasterRow) => void;
}) {
  const [form, setForm] = useState<FormState>(() => toFormState(row, config));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(row, config));
  const title = rowTitle(row, config);

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const payload: Record<string, string | number | null> = {
        [config.titleKey]: form.title.trim(),
        description: form.description.trim() || null,
        displayOrder: Number(form.displayOrder) || 0,
      };
      if (config.codeEditable) payload.code = form.code.trim();
      const updated = await patchJson<MasterRow>(`${config.apiPath}/${row.id}`, payload);
      toast.success(`"${rowTitle(updated, config)}" updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : `Couldn't update this ${config.noun}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const updated = await patchJson<MasterRow>(`${config.apiPath}/${row.id}`, { active: !row.active });
      toast.success(updated.active ? `"${title}" enabled.` : `"${title}" disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : `Couldn't update this ${config.noun}. Please try again.`);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              row.active ? "bg-success/10 text-success" : "bg-error/10 text-error"
            )}
          >
            {row.active ? "Active" : "Disabled"}
          </span>
          {showService ? (
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent-on-light">
              {SERVICE_TYPE_LABELS[row.serviceType]}
            </span>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggle()} isLoading={toggling} disabled={saving}>
          {row.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <MasterFields
        idPrefix={`${config.titleKey}-${row.id}`}
        form={form}
        onChange={setForm}
        errors={errors}
        disabled={saving}
        config={config}
        codeLocked={!config.codeEditable}
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty || toggling}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewMasterForm({
  config,
  fixedServiceType,
  defaultServiceType,
  onCreated,
}: {
  config: ServiceOptionMasterConfig;
  fixedServiceType?: ServiceType;
  defaultServiceType: ServiceType | "";
  onCreated: (row: MasterRow) => void;
}) {
  const empty: FormState = { serviceType: fixedServiceType ?? defaultServiceType, title: "", code: "", description: "", displayOrder: "0" };
  const [form, setForm] = useState<FormState>(empty);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [creating, setCreating] = useState(false);
  const serviceType = fixedServiceType ?? form.serviceType;

  const handleCreate = async () => {
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<MasterRow>(config.apiPath, {
        serviceType,
        [config.titleKey]: form.title.trim(),
        code: form.code.trim(),
        description: form.description.trim() || null,
        displayOrder: Number(form.displayOrder) || 0,
      });
      toast.success(`"${rowTitle(created, config)}" added.`);
      onCreated(created);
      setForm({ ...empty, serviceType });
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : `Couldn't add this ${config.noun}. Please try again.`);
    } finally {
      setCreating(false);
    }
  };

  const canSubmit = !!serviceType && form.title.trim().length >= 2 && form.code.trim().length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-4">
      <h2 className="text-sm font-semibold text-ink-heading">New {config.noun}</h2>
      {fixedServiceType ? null : (
        <div className="sm:max-w-xs">
          <ServiceSelect
            id={`new-${config.titleKey}-service`}
            label="Service"
            value={form.serviceType}
            onChange={(value) => setForm({ ...form, serviceType: value })}
            disabled={creating}
            error={errors.serviceType?.[0]}
          />
        </div>
      )}
      <MasterFields
        idPrefix={`new-${config.titleKey}`}
        form={form}
        onChange={setForm}
        errors={errors}
        disabled={creating}
        config={config}
        codeLocked={false}
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!canSubmit}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add
        </Button>
      </div>
    </div>
  );
}

export function ServiceOptionMasterManager({ config, serviceType }: { config: ServiceOptionMasterConfig; serviceType?: ServiceType }) {
  const [state, setState] = useState<FetchState>("loading");
  const [rows, setRows] = useState<MasterRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [filter, setFilter] = useState<ServiceType | "">("");
  const activeFilter = serviceType ?? filter;
  const visible = activeFilter ? rows.filter((row) => row.serviceType === activeFilter) : rows;
  const { pageItems, paginationProps, resetPage } = useClientPagination(visible);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const url = serviceType ? `${config.apiPath}?serviceType=${encodeURIComponent(serviceType)}` : config.apiPath;
        const result = await getJson<MasterRow[]>(url);
        if (cancelled) return;
        setRows(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : `Couldn't load ${config.nounPlural}. Please try again.`);
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [config.apiPath, config.nounPlural, serviceType, reloadNonce]);

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
        title={`Couldn't load ${config.nounPlural}`}
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
    <div className="flex flex-col gap-3">
      {serviceType ? null : (
        <div className="sm:max-w-xs">
          <ServiceSelect id={`${config.titleKey}-service-filter`} label="Filter by service" value={filter}
            onChange={(next) => {
              setFilter(next);
              resetPage();
            }}
            includeAll
          />
        </div>
      )}
      {visible.length === 0 ? (
        <EmptyState title={`No ${config.nounPlural} yet`} description={config.emptyDescription} />
      ) : (
        pageItems.map((row) => (
          <MasterCard
            key={row.id}
            row={row}
            config={config}
            showService={!serviceType}
            onSaved={(updated) => setRows((current) => current.map((r) => (r.id === updated.id ? updated : r)))}
          />
        ))
      )}
      <ListPagination noun={config.noun} {...paginationProps} />
      <NewMasterForm
        key={activeFilter || "all"}
        config={config}
        fixedServiceType={serviceType}
        defaultServiceType={filter}
        onCreated={(created) => setRows((current) => [...current, created])}
      />
    </div>
  );
}
