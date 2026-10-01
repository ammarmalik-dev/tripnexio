"use client";

import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { TextField } from "@/components/forms/TextField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { SERVICE_TYPE_OPTIONS, SERVICE_TYPE_LABELS, BOOKING_STATUS_OPTIONS, LEAD_STATUS_OPTIONS } from "@/lib/crm/labels";
import { NOTIFICATION_EVENT_CATALOG } from "@/lib/notifications/events";
import { SERVICE_STATUS_SYSTEM_EVENTS, HOLD_MARKER, SYSTEM_EVENT_LABELS } from "@/lib/service-status/events";
import { cn } from "@/lib/cn";
import type { ServiceType, BookingStatus, LeadStatus } from "../../generated/prisma/enums";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { withReasonQuery } from "@/lib/validation/sensitive-action";
import { ListPagination } from "@/components/crm/ListPagination";
import { useClientPagination } from "@/components/crm/usePagination";

/** Group filter value for "every group" (an empty string is the real "ungrouped" group). */
const ALL_GROUPS = "__all";

const SYSTEM_EVENT_OPTIONS = [...SERVICE_STATUS_SYSTEM_EVENTS, HOLD_MARKER].map((value) => ({ value, label: SYSTEM_EVENT_LABELS[value] }));

type StatusScope = "LEAD" | "BOOKING";

interface StatusData {
  id: string;
  serviceType: ServiceType;
  scope: StatusScope;
  name: string;
  group: string | null;
  displayOrder: number;
  isTerminal: boolean;
  blocksRefund: boolean;
  customerLabel: string | null;
  mapsToLeadStatus: LeadStatus | null;
  mapsToBookingStatus: BookingStatus | null;
  notificationEvent: string | null;
  systemEvent: string | null;
  active: boolean;
  transitions: { id: string; toStatusId: string }[];
}

interface StatusFormState {
  name: string;
  group: string;
  displayOrder: string;
  isTerminal: boolean;
  blocksRefund: boolean;
  customerLabel: string;
  /** mapsToLeadStatus or mapsToBookingStatus, depending on the screen's scope. */
  mapsTo: string;
  notificationEvent: string;
  systemEvent: string;
}

function toFormState(status: StatusData): StatusFormState {
  return {
    name: status.name,
    group: status.group ?? "",
    displayOrder: String(status.displayOrder),
    isTerminal: status.isTerminal,
    blocksRefund: status.blocksRefund,
    customerLabel: status.customerLabel ?? "",
    mapsTo: (status.scope === "LEAD" ? status.mapsToLeadStatus : status.mapsToBookingStatus) ?? "",
    notificationEvent: status.notificationEvent ?? "",
    systemEvent: status.systemEvent ?? "",
  };
}

const EMPTY_FORM: StatusFormState = {
  name: "",
  group: "",
  displayOrder: "0",
  isTerminal: false,
  blocksRefund: false,
  customerLabel: "",
  mapsTo: "",
  notificationEvent: "",
  systemEvent: "",
};

function buildPayload(form: StatusFormState, scope: StatusScope) {
  return {
    name: form.name.trim(),
    group: form.group.trim() === "" ? undefined : form.group.trim(),
    displayOrder: Number(form.displayOrder) || 0,
    isTerminal: form.isTerminal,
    blocksRefund: form.blocksRefund,
    customerLabel: form.customerLabel.trim() === "" ? undefined : form.customerLabel.trim(),
    ...(scope === "LEAD"
      ? { mapsToLeadStatus: form.mapsTo === "" ? null : form.mapsTo }
      : { mapsToBookingStatus: form.mapsTo === "" ? null : form.mapsTo }),
    notificationEvent: form.notificationEvent === "" ? null : form.notificationEvent,
    systemEvent: form.systemEvent === "" ? null : form.systemEvent,
  };
}

function OptionSelect({
  id,
  label,
  value,
  emptyLabel,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  emptyLabel: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-heading">
        {label}
      </label>
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cn(fieldControlClass, fieldBorderClass(false))}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function StatusFields({
  idPrefix,
  form,
  onChange,
  disabled,
  scope,
}: {
  /** Keeps control ids unique when several cards are on screen at once. */
  idPrefix: string;
  form: StatusFormState;
  onChange: (next: StatusFormState) => void;
  disabled: boolean;
  scope: StatusScope;
}) {
  const id = (field: string) => `${idPrefix}-${field}`;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField label="Name" name={id("name")} value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} disabled={disabled} />
      <TextField
        label="Group (optional)"
        name={id("group")}
        placeholder="e.g. Airline, Exceptions"
        value={form.group}
        onChange={(e) => onChange({ ...form, group: e.target.value })}
        disabled={disabled}
      />
      <TextField
        label="Display Order"
        name={id("displayOrder")}
        type="number"
        value={form.displayOrder}
        onChange={(e) => onChange({ ...form, displayOrder: e.target.value })}
        disabled={disabled}
      />
      <OptionSelect
        id={id("mapsTo")}
        label={scope === "LEAD" ? "Maps to Lead Status" : "Maps to Booking Status"}
        value={form.mapsTo}
        emptyLabel="Not mapped (keeps the current one)"
        options={scope === "LEAD" ? LEAD_STATUS_OPTIONS : BOOKING_STATUS_OPTIONS}
        onChange={(value) => onChange({ ...form, mapsTo: value })}
        disabled={disabled}
      />
      <OptionSelect
        id={id("systemEvent")}
        label="Moved here automatically on"
        value={form.systemEvent}
        emptyLabel="Staff only (no system event)"
        options={SYSTEM_EVENT_OPTIONS}
        onChange={(value) => onChange({ ...form, systemEvent: value })}
        disabled={disabled}
      />
      <OptionSelect
        id={id("notificationEvent")}
        label="Notify customer with"
        value={form.notificationEvent}
        emptyLabel="No message"
        options={NOTIFICATION_EVENT_CATALOG.map((entry) => ({ value: entry.event, label: entry.label }))}
        onChange={(value) => onChange({ ...form, notificationEvent: value })}
        disabled={disabled}
      />
      <TextField
        label="Customer-Safe Label (optional)"
        name={id("customerLabel")}
        placeholder="Shown to the customer instead of the internal name"
        value={form.customerLabel}
        onChange={(e) => onChange({ ...form, customerLabel: e.target.value })}
        disabled={disabled}
        className="sm:col-span-2"
      />
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input type="checkbox" checked={form.isTerminal} disabled={disabled} onChange={(e) => onChange({ ...form, isTerminal: e.target.checked })} />
        Terminal (no further transitions expected)
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-secondary">
        <input type="checkbox" checked={form.blocksRefund} disabled={disabled} onChange={(e) => onChange({ ...form, blocksRefund: e.target.checked })} />
        Blocks refund (sent to an external party)
      </label>
    </div>
  );
}

function StatusCard({
  status,
  allStatuses,
  onSaved,
  onTransitionChanged,
}: {
  status: StatusData;
  allStatuses: StatusData[];
  onSaved: (status: StatusData) => void;
  onTransitionChanged: () => void;
}) {
  const [form, setForm] = useState<StatusFormState>(toFormState(status));
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [newTransitionTarget, setNewTransitionTarget] = useState("");
  const [addingTransition, setAddingTransition] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(status));

  const handleSave = async () => {
    const reason = await confirm({
      title: `Update status "${status.name}"?`,
      description: "This changes the workflow/status configuration every Lead or Booking of this service follows from now on.",
      confirmLabel: "Save Changes",
    });
    if (!reason) return;
    setSaving(true);
    try {
      const updated = await patchJson<StatusData>(`/api/admin/service-statuses/${status.id}`, { ...buildPayload(form, status.scope), reason });
      toast.success(`Status "${updated.name}" updated.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    const reason = await confirm({
      title: `${status.active ? "Disable" : "Enable"} status "${status.name}"?`,
      description: status.active ? "Staff will no longer be able to move records into this status." : "Staff will be able to move records into this status again.",
      confirmLabel: status.active ? "Disable Status" : "Enable Status",
    });
    if (!reason) return;
    setTogglingActive(true);
    try {
      const updated = await patchJson<StatusData>(`/api/admin/service-statuses/${status.id}`, { active: !status.active, reason });
      toast.success(updated.active ? `${updated.name} enabled.` : `${updated.name} disabled.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this status. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  const handleAddTransition = async () => {
    if (!newTransitionTarget) return;
    const reason = await confirm({
      title: "Add status transition?",
      description: `Records in "${status.name}" will be allowed to move to "${allStatuses.find((s) => s.id === newTransitionTarget)?.name ?? "the selected status"}".`,
      confirmLabel: "Add Transition",
    });
    if (!reason) return;
    setAddingTransition(true);
    try {
      await postJson("/api/admin/service-status-transitions", { fromStatusId: status.id, toStatusId: newTransitionTarget, reason });
      toast.success("Transition added.");
      setNewTransitionTarget("");
      onTransitionChanged();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't add this transition. Please try again.");
    } finally {
      setAddingTransition(false);
    }
  };

  const transitionTargetIds = status.transitions.map((t) => t.toStatusId);
  const otherStatuses = allStatuses.filter((s) => s.id !== status.id && !transitionTargetIds.includes(s.id));

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink-heading">{status.name}</span>
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", status.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
            {status.active ? "Active" : "Disabled"}
          </span>
          {status.isTerminal ? (
            <span className="rounded-full bg-ink-primary/[0.06] px-2.5 py-1 text-xs font-medium text-ink-secondary">Terminal</span>
          ) : null}
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {status.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <StatusFields idPrefix={`status-${status.id}`} form={form} onChange={setForm} disabled={saving} scope={status.scope} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>

      <div className="border-t border-hairline pt-3">
        <p className="mb-2 text-xs font-medium uppercase text-ink-tertiary">Transitions to</p>
        <div className="flex flex-wrap gap-2">
          {status.transitions.length === 0 ? <span className="text-xs text-ink-tertiary">None configured yet.</span> : null}
          {status.transitions.map((transition) => {
            const target = allStatuses.find((s) => s.id === transition.toStatusId);
            return (
              <span key={transition.id} className="inline-flex items-center gap-1 rounded-full bg-ink-primary/[0.06] px-2.5 py-1 text-xs text-ink-secondary">
                {target?.name ?? transition.toStatusId}
                <RemoveTransitionButton transitionId={transition.id} onRemoved={onTransitionChanged} />
              </span>
            );
          })}
        </div>
        {otherStatuses.length > 0 ? (
          <div className="mt-2 flex items-center gap-2">
            <select
              value={newTransitionTarget}
              aria-label={`Add a transition from ${status.name}`}
              onChange={(e) => setNewTransitionTarget(e.target.value)}
              className={cn(fieldControlClass, fieldBorderClass(false), "h-9 w-auto min-w-[180px] text-sm")}
            >
              <option value="">Add transition to…</option>
              {otherStatuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button type="button" size="sm" variant="ghost" onClick={() => void handleAddTransition()} isLoading={addingTransition} disabled={!newTransitionTarget}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add
            </Button>
          </div>
        ) : null}
      </div>
      {dialog}
    </div>
  );
}

function RemoveTransitionButton({ transitionId, onRemoved }: { transitionId: string; onRemoved: () => void }) {
  const [removing, setRemoving] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  const handleRemove = async () => {
    const reason = await confirm({
      title: "Remove status transition?",
      description: "Records will no longer be able to move along this transition.",
      confirmLabel: "Remove Transition",
    });
    if (!reason) return;
    setRemoving(true);
    try {
      await deleteJson(withReasonQuery(`/api/admin/service-status-transitions/${transitionId}`, reason));
      onRemoved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove this transition. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleRemove()}
        disabled={removing}
        className="rounded-full text-ink-tertiary hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
        aria-label="Remove transition"
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </button>
      {dialog}
    </>
  );
}

function NewStatusForm({ serviceType, scope, onCreated }: { serviceType: ServiceType; scope: StatusScope; onCreated: (status: StatusData) => void }) {
  const [form, setForm] = useState<StatusFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const { confirm, dialog } = useConfirmAction();

  const handleCreate = async () => {
    const reason = await confirm({
      title: `Create status "${form.name.trim()}"?`,
      description: "This adds a new status to this service's workflow configuration.",
      confirmLabel: "Create Status",
    });
    if (!reason) return;
    setCreating(true);
    try {
      const created = await postJson<StatusData>("/api/admin/service-statuses", { serviceType, scope, ...buildPayload(form, scope), reason });
      toast.success(`Status "${created.name}" created.`);
      onCreated(created);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't create this status. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-hairline bg-surface-1 p-5">
      <h2 className="text-sm font-semibold text-ink-heading">New Status</h2>
      <StatusFields idPrefix={`new-status-${scope}`} form={form} onChange={setForm} disabled={creating} scope={scope} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!form.name.trim()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Status
        </Button>
      </div>
      {dialog}
    </div>
  );
}

type FetchState = "loading" | "success" | "error";
type ActiveFilter = "all" | "active" | "inactive";

/**
 * P23 — optional `serviceType` (Service Configuration hub) locks the manager
 * to that service and hides its own service picker. Absent = original
 * behaviour (own picker, defaulting to New Visa).
 */
export function ServiceStatusesManager({ serviceType: lockedServiceType }: { serviceType?: ServiceType } = {}) {
  const [pickedServiceType, setServiceType] = useState<ServiceType>("NEW_VISA");
  const serviceType = lockedServiceType ?? pickedServiceType;
  const [scope, setScope] = useState<StatusScope>("BOOKING");
  const [state, setState] = useState<FetchState>("loading");
  const [statuses, setStatuses] = useState<StatusData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");

  // Display order: each group in first-seen order, statuses in API order within it (as before pagination).
  // Pagination runs over this flat, ordered list and each page is regrouped, so a group heading repeats on
  // every page it spans and the order across pages never changes.
  const groups = Array.from(new Set(statuses.map((s) => s.group ?? "")));
  const ordered = groups.flatMap((group) => statuses.filter((s) => (s.group ?? "") === group));
  const query = search.trim().toLowerCase();
  const filtered = ordered.filter((status) => {
    if (groupFilter !== null && (status.group ?? "") !== groupFilter) return false;
    if (activeFilter === "active" && !status.active) return false;
    if (activeFilter === "inactive" && status.active) return false;
    return !query || [status.name, status.customerLabel, status.group].filter(Boolean).join(" ").toLowerCase().includes(query);
  });
  const { pageItems, paginationProps, resetPage } = useClientPagination(filtered);
  const pageGroups = Array.from(new Set(pageItems.map((s) => s.group ?? "")));
  const hasFilters = query !== "" || groupFilter !== null || activeFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setGroupFilter(null);
    setActiveFilter("all");
    resetPage();
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<StatusData[]>(`/api/admin/service-statuses?serviceType=${serviceType}&scope=${scope}`);
        if (cancelled) return;
        setStatuses(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load statuses. Please try again.");
        setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [serviceType, scope, reloadNonce]);

  return (
    <div className="flex flex-col gap-4">
      {lockedServiceType ? null : (
        <>
          <label htmlFor="service-status-service-select" className="sr-only">
            Select service
          </label>
          <select
            id="service-status-service-select"
            value={serviceType}
            onChange={(e) => {
              setServiceType(e.target.value as ServiceType);
              setGroupFilter(null);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[220px]")}
          >
            {SERVICE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )}
      <div className="flex gap-2" role="group" aria-label="Status list">
        {(["BOOKING", "LEAD"] as const).map((option) => (
          <Button key={option} type="button" size="sm" variant={scope === option ? "primary" : "ghost"}
            aria-pressed={scope === option}
            onClick={() => {
              setScope(option);
              setGroupFilter(null);
              resetPage();
            }}
          >
            {option === "BOOKING" ? "Booking statuses" : "Lead statuses"}
          </Button>
        ))}
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <ErrorState
          title="Couldn't load statuses"
          description={errorMessage}
          action={
            <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
              Try again
            </Button>
          }
        />
      ) : null}

      {state === "success" && statuses.length === 0 ? (
        <EmptyState title={`No statuses yet for ${SERVICE_TYPE_LABELS[serviceType]}`} description="Add the first one using the form below." />
      ) : null}

      {state === "success" && statuses.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary" aria-hidden="true" />
            <label htmlFor="service-status-search" className="sr-only">
              Search statuses
            </label>
            <input
              id="service-status-search"
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Search by status name or customer label…"
              className={cn(fieldControlClass, fieldBorderClass(false), "pl-9")}
            />
          </div>
          {groups.length > 1 ? (
            <>
              <label htmlFor="service-status-filter-group" className="sr-only">
                Filter by group
              </label>
              <select
                id="service-status-filter-group"
                value={groupFilter === null ? ALL_GROUPS : groupFilter}
                onChange={(event) => {
                  setGroupFilter(event.target.value === ALL_GROUPS ? null : event.target.value);
                  resetPage();
                }}
                className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[150px]")}
              >
                <option value={ALL_GROUPS}>All groups</option>
                {groups.map((group) => (
                  <option key={group} value={group}>
                    {group || "Ungrouped"}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          <label htmlFor="service-status-filter-active" className="sr-only">
            Filter by status
          </label>
          <select
            id="service-status-filter-active"
            value={activeFilter}
            onChange={(event) => {
              setActiveFilter(event.target.value as ActiveFilter);
              resetPage();
            }}
            className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[130px]")}
          >
            <option value="all">Active &amp; disabled</option>
            <option value="active">Active only</option>
            <option value="inactive">Disabled only</option>
          </select>
          {hasFilters ? (
            <Button type="button" variant="ghost" size="md" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      {state === "success" && statuses.length > 0 && filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          title="No statuses match these filters"
          description={`None of the ${statuses.length} statuses match. Try a different search term or clear the filters.`}
          action={
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : null}

      {state === "success"
        ? pageGroups.map((group) => (
            <div key={group} className="flex flex-col gap-3">
              {group ? <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">{group}</h3> : null}
              {pageItems
                .filter((s) => (s.group ?? "") === group)
                .map((status) => (
                  <StatusCard
                    key={status.id}
                    status={status}
                    allStatuses={statuses}
                    onSaved={(updated) => setStatuses((current) => current.map((s) => (s.id === updated.id ? updated : s)))}
                    onTransitionChanged={() => setReloadNonce((current) => current + 1)}
                  />
                ))}
            </div>
          ))
        : null}

      {state === "success" ? <ListPagination noun="status option" {...paginationProps} /> : null}

      {state === "success" ? (
        <NewStatusForm key={`${serviceType}-${scope}`} serviceType={serviceType} scope={scope} onCreated={(created) => setStatuses((current) => [...current, created])} />
      ) : null}
    </div>
  );
}
