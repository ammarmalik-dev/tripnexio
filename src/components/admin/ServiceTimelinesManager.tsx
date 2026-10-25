"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { EmptyState } from "@/components/ui/EmptyState";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, patchJson, postJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { useConfirmAction } from "@/components/ui/ConfirmActionDialog";
import { cn } from "@/lib/cn";
import { isCountryTimelineService } from "@/lib/settings/service-timeline-merge";
import { NewVisaCountryTimelines } from "./NewVisaCountryTimelines";
import { ServiceCountryTimelines } from "./ServiceCountryTimelines";
import type { ServiceType } from "../../generated/prisma/enums";

const ALL_SERVICE_TYPES = Object.keys(SERVICE_TYPE_LABELS) as ServiceType[];

interface TimelineData {
  id: string;
  serviceType: ServiceType;
  documentVerificationHours: number | null;
  expectedCompletionHours: number | null;
  quotationResponseMinutes: number | null;
  paymentDeadlineHours: number | null;
  followUpIntervalDays: number | null;
  minTravelDaysNormal: number | null;
  minTravelDaysExpress: number | null;
  processingDaysNormal: number | null;
  processingDaysExpress: number | null;
  autoCompleteAfterDays: number | null;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  documentVerificationHours: string;
  expectedCompletionHours: string;
  quotationResponseMinutes: string;
  paymentDeadlineHours: string;
  followUpIntervalDays: string;
  minTravelDaysNormal: string;
  minTravelDaysExpress: string;
  processingDaysNormal: string;
  processingDaysExpress: string;
  autoCompleteAfterDays: string;
}

function toFormState(item: TimelineData): FormState {
  return {
    documentVerificationHours: item.documentVerificationHours === null ? "" : String(item.documentVerificationHours),
    expectedCompletionHours: item.expectedCompletionHours === null ? "" : String(item.expectedCompletionHours),
    quotationResponseMinutes: item.quotationResponseMinutes === null ? "" : String(item.quotationResponseMinutes),
    paymentDeadlineHours: item.paymentDeadlineHours === null ? "" : String(item.paymentDeadlineHours),
    followUpIntervalDays: item.followUpIntervalDays === null ? "" : String(item.followUpIntervalDays),
    minTravelDaysNormal: item.minTravelDaysNormal === null ? "" : String(item.minTravelDaysNormal),
    minTravelDaysExpress: item.minTravelDaysExpress === null ? "" : String(item.minTravelDaysExpress),
    processingDaysNormal: item.processingDaysNormal === null ? "" : String(item.processingDaysNormal),
    processingDaysExpress: item.processingDaysExpress === null ? "" : String(item.processingDaysExpress),
    autoCompleteAfterDays: item.autoCompleteAfterDays === null ? "" : String(item.autoCompleteAfterDays),
  };
}

function buildPayload(form: FormState) {
  const toNullableInt = (value: string) => (value.trim() === "" ? null : Number(value));
  return {
    documentVerificationHours: toNullableInt(form.documentVerificationHours),
    expectedCompletionHours: toNullableInt(form.expectedCompletionHours),
    quotationResponseMinutes: toNullableInt(form.quotationResponseMinutes),
    paymentDeadlineHours: toNullableInt(form.paymentDeadlineHours),
    followUpIntervalDays: toNullableInt(form.followUpIntervalDays),
    minTravelDaysNormal: toNullableInt(form.minTravelDaysNormal),
    minTravelDaysExpress: toNullableInt(form.minTravelDaysExpress),
    processingDaysNormal: toNullableInt(form.processingDaysNormal),
    processingDaysExpress: toNullableInt(form.processingDaysExpress),
    autoCompleteAfterDays: toNullableInt(form.autoCompleteAfterDays),
  };
}

/**
 * "Copy these timelines to…" (Admin handover §3–§6 bulk apply) — copies the
 * saved fields every service shares to the chosen services in one request.
 */
function CopyServiceTimelinesPanel({ item, onClose, onCopied }: { item: TimelineData; onClose: () => void; onCopied: () => void }) {
  const [targets, setTargets] = useState<Set<ServiceType>>(new Set());
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirmAction();
  const others = ALL_SERVICE_TYPES.filter((serviceType) => serviceType !== item.serviceType);

  const submit = async () => {
    const reason = await confirm({
      title: `Copy ${SERVICE_TYPE_LABELS[item.serviceType]} timelines to ${targets.size} service${targets.size === 1 ? "" : "s"}?`,
      description:
        "Document verification, expected completion, quotation response, payment deadline and follow-up interval on each chosen service are replaced with this service's saved values.",
      confirmLabel: "Copy timelines",
    });
    if (!reason) return;
    setBusy(true);
    try {
      const result = await postJson<{ copied: number }>("/api/admin/service-timelines/copy", {
        mode: "SERVICE",
        sourceServiceType: item.serviceType,
        targetServiceTypes: [...targets],
        reason,
      });
      toast.success(`Timelines copied to ${result.copied} service${result.copied === 1 ? "" : "s"}.`);
      onCopied();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't copy the timelines.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-hairline p-4">
      <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
        <legend className="mb-1 text-sm font-medium text-ink-heading">Copy these saved timelines to…</legend>
        {others.map((serviceType) => (
          <label key={serviceType} className="flex items-center gap-2 text-sm text-ink-primary">
            <input
              type="checkbox"
              checked={targets.has(serviceType)}
              disabled={busy}
              onChange={() =>
                setTargets((current) => {
                  const next = new Set(current);
                  if (next.has(serviceType)) next.delete(serviceType);
                  else next.add(serviceType);
                  return next;
                })
              }
            />
            {SERVICE_TYPE_LABELS[serviceType]}
          </label>
        ))}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={() => void submit()} isLoading={busy} disabled={targets.size === 0}>
          Copy
        </Button>
      </div>
      {dialog}
    </div>
  );
}

function TimelineCard({ item, onSaved, onCopied }: { item: TimelineData; onSaved: (item: TimelineData) => void; onCopied: () => void }) {
  const [form, setForm] = useState<FormState>(toFormState(item));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [copying, setCopying] = useState(false);
  // Audit 2026-10 — New Visa has no quotation, its payment links never expire and the follow-up job doesn't read an
  // interval for it, so only the two SLA hours (Delay Analysis / alerts / escalation) apply service-wide; its
  // day-based timelines are set per country below.
  const slaOnly = item.serviceType === "NEW_VISA";

  const dirty = JSON.stringify(form) !== JSON.stringify(toFormState(item));

  const handleSave = async () => {
    setSaving(true);
    setErrors({});
    try {
      const updated = await patchJson<TimelineData>(`/api/admin/service-timelines/${item.id}`, buildPayload(form));
      toast.success(`${SERVICE_TYPE_LABELS[updated.serviceType]} timelines updated.`);
      onSaved(updated);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors) setErrors(error.fieldErrors);
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this configuration. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    setTogglingActive(true);
    try {
      const updated = await patchJson<TimelineData>(`/api/admin/service-timelines/${item.id}`, { active: !item.active });
      toast.success(updated.active ? "Enabled." : "Disabled.");
      onSaved(updated);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't update this configuration. Please try again.");
    } finally {
      setTogglingActive(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-hairline bg-surface-1 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-heading">{SERVICE_TYPE_LABELS[item.serviceType]}</h3>
        <div className="flex items-center gap-2">
          <span
            className={cn("rounded-full px-2.5 py-1 text-xs font-medium", item.active ? "bg-success/10 text-success" : "bg-error/10 text-error")}
          >
            {item.active ? "Active" : "Disabled"}
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={() => void handleToggleActive()} isLoading={togglingActive}>
            {item.active ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField
          label="Document Verification (hours)"
          name={`docverify-${item.id}`}
          type="number"
          min={0}
          placeholder="Not set"
          hint="Delay Analysis, delay alerts and SLA escalation."
          value={form.documentVerificationHours}
          onChange={(event) => setForm({ ...form, documentVerificationHours: event.target.value })}
          error={errors.documentVerificationHours?.[0]}
          disabled={saving}
        />
        <TextField
          label="Expected Completion (hours)"
          name={`completion-${item.id}`}
          type="number"
          min={0}
          placeholder="Not set"
          hint="Delay Analysis, delay alerts and SLA escalation."
          value={form.expectedCompletionHours}
          onChange={(event) => setForm({ ...form, expectedCompletionHours: event.target.value })}
          error={errors.expectedCompletionHours?.[0]}
          disabled={saving}
        />
        {slaOnly ? null : (
          <>
        <TextField
          label="Quotation Response (minutes)"
          name={`quoteresp-${item.id}`}
          type="number"
          min={0}
          placeholder="Not set"
          hint="Caps how long a quote's validity can be set to."
          value={form.quotationResponseMinutes}
          onChange={(event) => setForm({ ...form, quotationResponseMinutes: event.target.value })}
          error={errors.quotationResponseMinutes?.[0]}
          disabled={saving}
        />
        <TextField
          label="Payment Deadline (hours)"
          name={`paydeadline-${item.id}`}
          type="number"
          min={0}
          placeholder="Not set"
          hint="How long a payment link stays valid."
          value={form.paymentDeadlineHours}
          onChange={(event) => setForm({ ...form, paymentDeadlineHours: event.target.value })}
          error={errors.paymentDeadlineHours?.[0]}
          disabled={saving}
        />
        <TextField
          label="Follow-up Interval (days)"
          name={`followup-${item.id}`}
          type="number"
          min={1}
          placeholder="Not set"
          hint="Days between reminders for a lead with no booking yet. Flight Special Fare uses 7 when not set."
          value={form.followUpIntervalDays}
          onChange={(event) => setForm({ ...form, followUpIntervalDays: event.target.value })}
          error={errors.followUpIntervalDays?.[0]}
          disabled={saving}
        />
          </>
        )}
        {/* Client doc 2026-10-15 — New Visa timelines are set per country only (below), not service-wide. */}
        {item.serviceType === "RETURN_TICKET" ? (
          <TextField
            label="Auto-complete: days after travel date"
            name={`auto-complete-${item.id}`}
            type="number"
            min={0}
            placeholder="0 (default)"
            hint="A delivered booking moves to Completed this many days after its travel date. Uses 0 when not set."
            value={form.autoCompleteAfterDays}
            onChange={(event) => setForm({ ...form, autoCompleteAfterDays: event.target.value })}
            error={errors.autoCompleteAfterDays?.[0]}
            disabled={saving}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setCopying((current) => !current)}
          disabled={saving || dirty}
          title={dirty ? "Save your changes before copying them." : undefined}
        >
          Copy these timelines to…
        </Button>
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
      {copying ? (
        <CopyServiceTimelinesPanel
          item={item}
          onClose={() => setCopying(false)}
          onCopied={() => {
            setCopying(false);
            onCopied();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Step 42 (Admin FINAL handover §6) — one row per service, pre-created by
 * the seed (and self-healingly by the GET route) so there's never a
 * "create" step, just 6 always-present editable cards. Quotation Response
 * and Payment Deadline are wired into real logic (see the field hints);
 * Document Verification and Expected Completion are captured here but not
 * yet wired into an automation trigger — flagged in the UI itself, not
 * silently hidden.
 */
/** P23 — optional `serviceType` (Service Configuration hub) shows only that service's card. Absent = every service. */
export function ServiceTimelinesManager({ serviceType }: { serviceType?: ServiceType } = {}) {
  const [state, setState] = useState<FetchState>("loading");
  const [items, setItems] = useState<TimelineData[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setState("loading");
      try {
        const result = await getJson<TimelineData[]>("/api/admin/service-timelines");
        if (cancelled) return;
        setItems(result);
        setState("success");
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof ApiError ? error.message : "Couldn't load service timelines. Please try again.");
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
        title="Couldn't load service timelines"
        description={errorMessage}
        action={
          <Button type="button" size="sm" onClick={() => setReloadNonce((current) => current + 1)}>
            Try again
          </Button>
        }
      />
    );
  }

  const visibleItems = serviceType ? items.filter((item) => item.serviceType === serviceType) : items;

  if (serviceType && visibleItems.length === 0) {
    return (
      <EmptyState
        title={`No timeline row for ${SERVICE_TYPE_LABELS[serviceType]}`}
        description="This service has no timeline configuration row yet."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {visibleItems.map((item) => (
        <div key={item.id} className="flex flex-col gap-4">
          <TimelineCard
            item={item}
            onSaved={(updated) => setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
            onCopied={() => setReloadNonce((current) => current + 1)}
          />
          {/* Client testing 2026-10-09 (B31) — per-country New Visa timelines. */}
          {item.serviceType === "NEW_VISA" ? <NewVisaCountryTimelines /> : null}
          {/* Admin handover §6 — per-country timelines for Return Ticket / Visa Extension / Visa Change / Special Fare. */}
          {isCountryTimelineService(item.serviceType) ? <ServiceCountryTimelines serviceType={item.serviceType} /> : null}
        </div>
      ))}
    </div>
  );
}
