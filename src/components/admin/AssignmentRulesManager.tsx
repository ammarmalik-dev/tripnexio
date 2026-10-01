"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { FormField, fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import { SERVICE_TYPE_LABELS, SERVICE_TYPE_OPTIONS } from "@/lib/crm/labels";
import type { ServiceType } from "../../generated/prisma/enums";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

type ActiveFilter = "all" | "active" | "inactive";

interface AssignmentRuleData {
  id: string;
  serviceType: ServiceType;
  subServiceId: string | null;
  roleId: string | null;
  maxOpenLeads: number | null;
  priority: number;
  active: boolean;
}

interface SubServiceOption {
  id: string;
  serviceType: ServiceType;
  name: string;
  active: boolean;
}

interface RoleOption {
  id: string;
  name: string;
}

interface Options {
  subServices: SubServiceOption[];
  roles: RoleOption[];
}

/** Form state — numbers kept as strings (native inputs), converted on save. */
interface Draft {
  serviceType: ServiceType;
  subServiceId: string;
  roleId: string;
  maxOpenLeads: string;
  priority: string;
}

type FieldErrors = Record<string, string[] | undefined>;

function toDraft(rule: AssignmentRuleData): Draft {
  return {
    serviceType: rule.serviceType,
    subServiceId: rule.subServiceId ?? "",
    roleId: rule.roleId ?? "",
    maxOpenLeads: rule.maxOpenLeads === null ? "" : String(rule.maxOpenLeads),
    priority: String(rule.priority),
  };
}

const EMPTY_DRAFT: Draft = { serviceType: SERVICE_TYPE_OPTIONS[0].value, subServiceId: "", roleId: "", maxOpenLeads: "", priority: "0" };

/** Converts a draft to the API payload; returns field errors for obviously bad numbers before any request. */
function toPayload(draft: Draft): { payload: Record<string, unknown> } | { errors: FieldErrors } {
  const errors: FieldErrors = {};
  const max = draft.maxOpenLeads.trim();
  const priority = draft.priority.trim();
  if (max !== "" && !/^\d+$/.test(max)) errors.maxOpenLeads = ["Enter a whole number, or leave blank"];
  if (!/^-?\d+$/.test(priority)) errors.priority = ["Enter a whole number"];
  if (Object.keys(errors).length > 0) return { errors };
  return {
    payload: {
      serviceType: draft.serviceType,
      subServiceId: draft.subServiceId || null,
      roleId: draft.roleId || null,
      maxOpenLeads: max === "" ? null : Number(max),
      priority: Number(priority),
    },
  };
}

function RuleFields({
  idPrefix,
  draft,
  onChange,
  options,
  errors,
  disabled,
}: {
  idPrefix: string;
  draft: Draft;
  onChange: (next: Draft) => void;
  options: Options;
  errors: FieldErrors;
  disabled: boolean;
}) {
  const subServices = options.subServices.filter((option) => option.serviceType === draft.serviceType);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <FormField label="Service" htmlFor={`${idPrefix}-service`} error={errors.serviceType?.[0]}>
        <select
          id={`${idPrefix}-service`}
          value={draft.serviceType}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, serviceType: event.target.value as ServiceType, subServiceId: "" })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.serviceType))}
        >
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Sub-service" htmlFor={`${idPrefix}-sub-service`} error={errors.subServiceId?.[0]}>
        <select
          id={`${idPrefix}-sub-service`}
          value={draft.subServiceId}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, subServiceId: event.target.value })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.subServiceId))}
        >
          <option value="">Any (service-wide)</option>
          {subServices.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.active ? "" : " (disabled)"}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Role" htmlFor={`${idPrefix}-role`} error={errors.roleId?.[0]}>
        <select
          id={`${idPrefix}-role`}
          value={draft.roleId}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, roleId: event.target.value })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.roleId))}
        >
          <option value="">Any role</option>
          {options.roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </FormField>
      <TextField
        label="Max open leads"
        name={`${idPrefix}-max-open`}
        inputMode="numeric"
        placeholder="No limit"
        value={draft.maxOpenLeads}
        disabled={disabled}
        onChange={(event) => onChange({ ...draft, maxOpenLeads: event.target.value })}
        error={errors.maxOpenLeads?.[0]}
      />
      <TextField
        label="Priority"
        name={`${idPrefix}-priority`}
        inputMode="numeric"
        hint="Higher runs first"
        value={draft.priority}
        disabled={disabled}
        onChange={(event) => onChange({ ...draft, priority: event.target.value })}
        error={errors.priority?.[0]}
      />
    </div>
  );
}

function RuleCard({
  rule,
  options,
  onSaved,
  onDeleted,
}: {
  rule: AssignmentRuleData;
  options: Options;
  onSaved: (rule: AssignmentRuleData) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(rule));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState<"save" | "toggle" | "delete" | null>(null);
  const { confirm, dialog } = useConfirmAction();
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(rule));

  const save = async () => {
    const converted = toPayload(draft);
    if ("errors" in converted) {
      setErrors(converted.errors);
      return;
    }
    setBusy("save");
    setErrors({});
    try {
      const updated = await patchJson<AssignmentRuleData>(`/api/admin/assignment-rules/${rule.id}`, converted.payload);
      toast.success("Assignment rule saved.");
      setDraft(toDraft(updated));
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't save this rule. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const toggle = async () => {
    setBusy("toggle");
    try {
      const updated = await patchJson<AssignmentRuleData>(`/api/admin/assignment-rules/${rule.id}`, { active: !rule.active });
      toast.success(updated.active ? "Rule enabled." : "Rule disabled.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this rule. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    const reason = await confirm({
      title: "Delete this assignment rule?",
      description: "This permanently removes the rule. Auto-assignment / escalation stops using it immediately.",
      confirmLabel: "Delete rule",
    });
    if (!reason) return;
    setBusy("delete");
    try {
      await deleteJson<{ id: string }>(withReasonQuery(`/api/admin/assignment-rules/${rule.id}`, reason));
      toast.success("Assignment rule deleted.");
      onDeleted(rule.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't delete this rule. Please try again.");
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-hairline bg-surface-1 p-4">
      {dialog}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-primary">{SERVICE_TYPE_LABELS[rule.serviceType]}</p>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", rule.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
          {rule.active ? "Active" : "Disabled"}
        </span>
      </div>
      <RuleFields idPrefix={`rule-${rule.id}`} draft={draft} onChange={setDraft} options={options} errors={errors} disabled={busy !== null} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => void remove()} isLoading={busy === "delete"} disabled={busy !== null && busy !== "delete"}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void toggle()} isLoading={busy === "toggle"} disabled={busy !== null && busy !== "toggle"}>
          {rule.active ? "Disable" : "Enable"}
        </Button>
        <Button type="button" size="sm" onClick={() => void save()} isLoading={busy === "save"} disabled={!dirty || (busy !== null && busy !== "save")}>
          Save Changes
        </Button>
      </div>
    </div>
  );
}

function NewRuleForm({ options, onCreated }: { options: Options; onCreated: (rule: AssignmentRuleData) => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const converted = toPayload(draft);
    if ("errors" in converted) {
      setErrors(converted.errors);
      return;
    }
    setCreating(true);
    setErrors({});
    try {
      const created = await postJson<AssignmentRuleData>("/api/admin/assignment-rules", { ...converted.payload, active: true });
      toast.success("Assignment rule added.");
      onCreated(created);
      setDraft(EMPTY_DRAFT);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this rule. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-hairline bg-surface-1 p-4">
      <h2 className="text-sm font-semibold text-ink-heading">New Assignment Rule</h2>
      <RuleFields idPrefix="new-rule" draft={draft} onChange={setDraft} options={options} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void create()} isLoading={creating}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Rule
        </Button>
      </div>
    </div>
  );
}

/** P24 item 3 — Admin → Assignment Rules. The API (/api/admin/assignment-rules) enforces staff.manage server-side. */
export function AssignmentRulesManager() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [rules, setRules] = useState<AssignmentRuleData[]>([]);
  const [options, setOptions] = useState<Options>({ subServices: [], roles: [] });
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [serviceFilter, setServiceFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const filtered = rules.filter((rule) => {
    if (serviceFilter && rule.serviceType !== serviceFilter) return false;
    if (activeFilter === "active" && !rule.active) return false;
    if (activeFilter === "inactive" && rule.active) return false;
    return true;
  });
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);
  const hasFilters = serviceFilter !== "" || activeFilter !== "all";
  const clearFilters = () => {
    setServiceFilter("");
    setActiveFilter("all");
    resetPage();
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<{ rules: AssignmentRuleData[] } & Options>("/api/admin/assignment-rules");
        if (cancelled) return;
        setRules(result.rules);
        setOptions({ subServices: result.subServices, roles: result.roles });
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load assignment rules. Please try again.");
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
          <Skeleton key={index} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title="Couldn't load assignment rules"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const replace = (updated: AssignmentRuleData) => setRules((current) => current.map((rule) => (rule.id === updated.id ? updated : rule)));

  return (
    <div className="flex flex-col gap-3">
      {rules.length === 0 ? (
        <EmptyState
          title="No assignment rules yet"
          description="Without rules, auto-assign picks the rostered staff member with the lowest PAX workload. Add a rule to limit it by role or open-lead count."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="assignment-rule-filter-service" className="sr-only">
              Filter by service
            </label>
            <select
              id="assignment-rule-filter-service"
              value={serviceFilter}
              onChange={(event) => {
                setServiceFilter(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[180px]")}
            >
              <option value="">All services</option>
              {SERVICE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label htmlFor="assignment-rule-filter-active" className="sr-only">
              Filter by status
            </label>
            <select
              id="assignment-rule-filter-active"
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
              title="No rules match these filters"
              description={`None of the ${rules.length} rules match. Clear the filters to see them all.`}
              action={
                <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <>
              {pageItems.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  options={options}
                  onSaved={replace}
                  onDeleted={(id) => setRules((current) => current.filter((entry) => entry.id !== id))}
                />
              ))}
              <ListPagination noun="assignment rule" {...paginationProps} />
            </>
          )}
        </>
      )}
      <NewRuleForm options={options} onCreated={(created) => setRules((current) => [...current, created])} />
    </div>
  );
}
