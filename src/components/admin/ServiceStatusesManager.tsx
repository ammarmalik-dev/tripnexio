"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { fieldControlClass, fieldBorderClass } from "@/components/forms/FormField";
import { TextField } from "@/components/forms/TextField";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { getJson, postJson, patchJson, deleteJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { SERVICE_TYPE_OPTIONS, SERVICE_TYPE_LABELS, BOOKING_STATUS_OPTIONS } from "@/lib/crm/labels";
import { cn } from "@/lib/cn";
import type { ServiceType, BookingStatus } from "../../generated/prisma/enums";

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
  mapsToLeadStatus: string | null;
  mapsToBookingStatus: BookingStatus | null;
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
  mapsToBookingStatus: string;
}

function toFormState(status: StatusData): StatusFormState {
  return {
    name: status.name,
    group: status.group ?? "",
    displayOrder: String(status.displayOrder),
    isTerminal: status.isTerminal,
    blocksRefund: status.blocksRefund,
    customerLabel: status.customerLabel ?? "",
    mapsToBookingStatus: status.mapsToBookingStatus ?? "",
  };
}

const EMPTY_FORM: StatusFormState = {
  name: "",
  group: "",
  displayOrder: "0",
  isTerminal: false,
  blocksRefund: false,
  customerLabel: "",
  mapsToBookingStatus: "",
};

function buildPayload(form: StatusFormState) {
  return {
    name: form.name.trim(),
    group: form.group.trim() === "" ? undefined : form.group.trim(),
    displayOrder: Number(form.displayOrder) || 0,
    isTerminal: form.isTerminal,
    blocksRefund: form.blocksRefund,
    customerLabel: form.customerLabel.trim() === "" ? undefined : form.customerLabel.trim(),
    mapsToBookingStatus: form.mapsToBookingStatus === "" ? null : form.mapsToBookingStatus,
  };
}

function StatusFields({ form, onChange, disabled }: { form: StatusFormState; onChange: (next: StatusFormState) => void; disabled: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <TextField label="Name" name="name" value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })} disabled={disabled} />
      <TextField
        label="Group (optional)"
        name="group"
        placeholder="e.g. Airline, Exceptions"
        value={form.group}
        onChange={(e) => onChange({ ...form, group: e.target.value })}
        disabled={disabled}
      />
      <TextField
        label="Display Order"
        name="displayOrder"
        type="number"
        value={form.displayOrder}
        onChange={(e) => onChange({ ...form, displayOrder: e.target.value })}
        disabled={disabled}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mapsToBookingStatus" className="text-sm font-medium text-ink-heading">
          Maps to Booking Status
        </label>
        <select
          id="mapsToBookingStatus"
          value={form.mapsToBookingStatus}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, mapsToBookingStatus: e.target.value })}
          className={cn(fieldControlClass, fieldBorderClass(false))}
        >
          <option value="">Not mapped</option>
          {BOOKING_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <TextField
        label="Customer-Safe Label (optional)"
        name="customerLabel"
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

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(status));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await patchJson<StatusData>(`/api/admin/service-statuses/${status.id}`, buildPayload(form));
      toast.success(`Status "${updated.name}" updated.`);
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this status. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<StatusData>(`/api/admin/service-statuses/${status.id}`, { active: !status.active });
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
    setAddingTransition(true);
    try {
      await postJson("/api/admin/service-status-transitions", { fromStatusId: status.id, toStatusId: newTransitionTarget });
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
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium", status.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
          {status.active ? "Active" : "Disabled"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
          {status.active ? "Disable" : "Enable"}
        </Button>
      </div>
      <StatusFields form={form} onChange={setForm} disabled={saving} />
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
    </div>
  );
}

function RemoveTransitionButton({ transitionId, onRemoved }: { transitionId: string; onRemoved: () => void }) {
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await deleteJson(`/api/admin/service-status-transitions/${transitionId}`);
      onRemoved();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't remove this transition. Please try again.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <button type="button" onClick={() => void handleRemove()} disabled={removing} className="text-ink-tertiary hover:text-error" aria-label="Remove transition">
      <X className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

function NewStatusForm({ serviceType, scope, onCreated }: { serviceType: ServiceType; scope: StatusScope; onCreated: (status: StatusData) => void }) {
  const [form, setForm] = useState<StatusFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await postJson<StatusData>("/api/admin/service-statuses", { serviceType, scope, ...buildPayload(form) });
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
      <StatusFields form={form} onChange={setForm} disabled={creating} />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleCreate()} isLoading={creating} disabled={!form.name.trim()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Status
        </Button>
      </div>
    </div>
  );
}

type FetchState = "loading" | "success" | "error";

export function ServiceStatusesManager() {
  const [serviceType, setServiceType] = useState<ServiceType>("NEW_VISA");
  const [state, setState] = useState<FetchState>("loading");
  const [statuses, setStatuses] = useState<StatusData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<StatusData[]>(`/api/admin/service-statuses?serviceType=${serviceType}&scope=BOOKING`);
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
  }, [serviceType, reloadNonce]);

  const groups = Array.from(new Set(statuses.map((s) => s.group ?? "")));

  return (
    <div className="flex flex-col gap-4">
      <label htmlFor="service-status-service-select" className="sr-only">
        Select service
      </label>
      <select
        id="service-status-service-select"
        value={serviceType}
        onChange={(e) => setServiceType(e.target.value as ServiceType)}
        className={cn(fieldControlClass, fieldBorderClass(false), "w-auto min-w-[220px]")}
      >
        {SERVICE_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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

      {state === "success"
        ? groups.map((group) => (
            <div key={group} className="flex flex-col gap-3">
              {group ? <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-tertiary">{group}</h3> : null}
              {statuses
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

      {state === "success" ? <NewStatusForm serviceType={serviceType} scope="BOOKING" onCreated={(created) => setStatuses((current) => [...current, created])} /> : null}
    </div>
  );
}
