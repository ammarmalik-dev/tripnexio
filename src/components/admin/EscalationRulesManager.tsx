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
import { ESCALATE_TO_LABELS, ESCALATE_TO_VALUES, type EscalateTo } from "@/lib/validation/escalation-rule-schema";
import type { ServiceType } from "../../generated/prisma/enums";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

type ActiveFilter = "all" | "active" | "inactive";

/** Service filter value for rules that apply to every service (serviceType null). */
const ALL_SERVICES_ONLY = "__all";

interface EscalationRuleData {
  id: string;
  serviceType: ServiceType | null;
  serviceStatusId: string | null;
  hoursInStatus: number;
  escalateTo: string;
  active: boolean;
}

interface StatusOption {
  id: string;
  serviceType: ServiceType;
  name: string;
  active: boolean;
}

interface Draft {
  serviceType: ServiceType | "";
  serviceStatusId: string;
  hoursInStatus: string;
  escalateTo: EscalateTo;
}

type FieldErrors = Record<string, string[] | undefined>;

function isEscalateTo(value: string): value is EscalateTo {
  return (ESCALATE_TO_VALUES as readonly string[]).includes(value);
}

function toDraft(rule: EscalationRuleData): Draft {
  return {
    serviceType: rule.serviceType ?? "",
    serviceStatusId: rule.serviceStatusId ?? "",
    hoursInStatus: String(rule.hoursInStatus),
    escalateTo: isEscalateTo(rule.escalateTo) ? rule.escalateTo : "MANAGERS",
  };
}

const EMPTY_DRAFT: Draft = { serviceType: "", serviceStatusId: "", hoursInStatus: "24", escalateTo: "MANAGERS" };

function toPayload(draft: Draft): { payload: Record<string, unknown> } | { errors: FieldErrors } {
  const hours = draft.hoursInStatus.trim();
  if (!/^\d+$/.test(hours) || Number(hours) < 1) return { errors: { hoursInStatus: ["Enter a whole number of hours (at least 1)"] } };
  return {
    payload: {
      serviceType: draft.serviceType || null,
      serviceStatusId: draft.serviceType ? draft.serviceStatusId || null : null,
      hoursInStatus: Number(hours),
      escalateTo: draft.escalateTo,
    },
  };
}

function RuleFields({
  idPrefix,
  draft,
  onChange,
  statuses,
  errors,
  disabled,
}: {
  idPrefix: string;
  draft: Draft;
  onChange: (next: Draft) => void;
  statuses: StatusOption[];
  errors: FieldErrors;
  disabled: boolean;
}) {
  const serviceStatuses = draft.serviceType ? statuses.filter((status) => status.serviceType === draft.serviceType) : [];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <FormField label="Service" htmlFor={`${idPrefix}-service`} error={errors.serviceType?.[0]}>
        <select
          id={`${idPrefix}-service`}
          value={draft.serviceType}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, serviceType: event.target.value as ServiceType | "", serviceStatusId: "" })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.serviceType))}
        >
          <option value="">Every service</option>
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Status"
        htmlFor={`${idPrefix}-status`}
        error={errors.serviceStatusId?.[0]}
        hint={draft.serviceType ? undefined : "Pick a service to choose a status"}
      >
        <select
          id={`${idPrefix}-status`}
          value={draft.serviceStatusId}
          disabled={disabled || !draft.serviceType}
          onChange={(event) => onChange({ ...draft, serviceStatusId: event.target.value })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.serviceStatusId))}
        >
          <option value="">Any open status</option>
          {serviceStatuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
              {status.active ? "" : " (disabled)"}
            </option>
          ))}
        </select>
      </FormField>
      <TextField
        label="Hours in status"
        name={`${idPrefix}-hours`}
        inputMode="numeric"
        value={draft.hoursInStatus}
        disabled={disabled}
        onChange={(event) => onChange({ ...draft, hoursInStatus: event.target.value })}
        error={errors.hoursInStatus?.[0]}
      />
      <FormField label="Escalate to" htmlFor={`${idPrefix}-escalate-to`} error={errors.escalateTo?.[0]}>
        <select
          id={`${idPrefix}-escalate-to`}
          value={draft.escalateTo}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, escalateTo: isEscalateTo(event.target.value) ? event.target.value : "MANAGERS" })}
          className={cn(fieldControlClass, fieldBorderClass(!!errors.escalateTo))}
        >
          {ESCALATE_TO_VALUES.map((value) => (
            <option key={value} value={value}>
              {ESCALATE_TO_LABELS[value]}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}

function describeRule(rule: EscalationRuleData, statuses: StatusOption[]): string {
  const service = rule.serviceType ? SERVICE_TYPE_LABELS[rule.serviceType] : "Every service";
  const status = rule.serviceStatusId ? (statuses.find((entry) => entry.id === rule.serviceStatusId)?.name ?? "Unknown status") : "any open status";
  return `${service} · ${status} · after ${rule.hoursInStatus} h`;
}

function RuleCard({
  rule,
  statuses,
  onSaved,
  onDeleted,
}: {
  rule: EscalationRuleData;
  statuses: StatusOption[];
  onSaved: (rule: EscalationRuleData) => void;
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
      const updated = await patchJson<EscalationRuleData>(`/api/admin/escalation-rules/${rule.id}`, converted.payload);
      toast.success("Escalation rule saved.");
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
      const updated = await patchJson<EscalationRuleData>(`/api/admin/escalation-rules/${rule.id}`, { active: !rule.active });
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
      title: "Delete this escalation rule?",
      description: "This permanently removes the rule. Auto-assignment / escalation stops using it immediately.",
      confirmLabel: "Delete rule",
    });
    if (!reason) return;
    setBusy("delete");
    try {
      await deleteJson<{ id: string }>(withReasonQuery(`/api/admin/escalation-rules/${rule.id}`, reason));
      toast.success("Escalation rule deleted.");
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
        <p className="text-sm font-medium text-ink-primary">{describeRule(rule, statuses)}</p>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", rule.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
          {rule.active ? "Active" : "Disabled"}
        </span>
      </div>
      <RuleFields idPrefix={`esc-${rule.id}`} draft={draft} onChange={setDraft} statuses={statuses} errors={errors} disabled={busy !== null} />
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

function NewRuleForm({ statuses, onCreated }: { statuses: StatusOption[]; onCreated: (rule: EscalationRuleData) => void }) {
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
      const created = await postJson<EscalationRuleData>("/api/admin/escalation-rules", { ...converted.payload, active: true });
      toast.success("Escalation rule added.");
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
      <h2 className="text-sm font-semibold text-ink-heading">New Escalation Rule</h2>
      <RuleFields idPrefix="new-esc" draft={draft} onChange={setDraft} statuses={statuses} errors={errors} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void create()} isLoading={creating}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Rule
        </Button>
      </div>
    </div>
  );
}

/** P24 item 3 — Admin → SLA Escalation. The API (/api/admin/escalation-rules) enforces staff.manage server-side. */
export function EscalationRulesManager() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [rules, setRules] = useState<EscalationRuleData[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [serviceFilter, setServiceFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  const filtered = rules.filter((rule) => {
    // A service-wide (null) rule applies to every service, so it stays visible under any service filter.
    if (serviceFilter === ALL_SERVICES_ONLY ? rule.serviceType !== null : serviceFilter !== "" && rule.serviceType !== null && rule.serviceType !== serviceFilter) return false;
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
        const result = await getJson<{ rules: EscalationRuleData[]; statuses: StatusOption[] }>("/api/admin/escalation-rules");
        if (cancelled) return;
        setRules(result.rules);
        setStatuses(result.statuses);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load escalation rules. Please try again.");
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
        title="Couldn't load escalation rules"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const replace = (updated: EscalationRuleData) => setRules((current) => current.map((rule) => (rule.id === updated.id ? updated : rule)));

  return (
    <div className="flex flex-col gap-3">
      {rules.length === 0 ? (
        <EmptyState
          title="No escalation rules yet"
          description="Add a rule to alert managers or admins when a booking stays in a status longer than it should."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="escalation-rule-filter-service" className="sr-only">
              Filter by service
            </label>
            <select
              id="escalation-rule-filter-service"
              value={serviceFilter}
              onChange={(event) => {
                setServiceFilter(event.target.value);
                resetPage();
              }}
              className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[180px]")}
            >
              <option value="">All services</option>
              <option value={ALL_SERVICES_ONLY}>All-services rules only</option>
              {SERVICE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label htmlFor="escalation-rule-filter-active" className="sr-only">
              Filter by status
            </label>
            <select
              id="escalation-rule-filter-active"
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
                  statuses={statuses}
                  onSaved={replace}
                  onDeleted={(id) => setRules((current) => current.filter((entry) => entry.id !== id))}
                />
              ))}
              <ListPagination noun="escalation rule" {...paginationProps} />
            </>
          )}
        </>
      )}
      <NewRuleForm statuses={statuses} onCreated={(created) => setRules((current) => [...current, created])} />
    </div>
  );
}
