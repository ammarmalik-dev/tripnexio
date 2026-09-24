"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/forms/TextField";
import { SERVICE_TYPE_LABELS } from "@/lib/crm/labels";
import { getJson, patchJson, ApiError } from "@/lib/api/client";
import { toast } from "@/components/ui/Toaster";
import { cn } from "@/lib/cn";
import type { ServiceType } from "../../generated/prisma/enums";

interface TimelineData {
  id: string;
  serviceType: ServiceType;
  documentVerificationHours: number | null;
  expectedCompletionHours: number | null;
  quotationResponseMinutes: number | null;
  paymentDeadlineHours: number | null;
  active: boolean;
}

type FetchState = "loading" | "success" | "error";

interface FormState {
  documentVerificationHours: string;
  expectedCompletionHours: string;
  quotationResponseMinutes: string;
  paymentDeadlineHours: string;
}

function toFormState(item: TimelineData): FormState {
  return {
    documentVerificationHours: item.documentVerificationHours === null ? "" : String(item.documentVerificationHours),
    expectedCompletionHours: item.expectedCompletionHours === null ? "" : String(item.expectedCompletionHours),
    quotationResponseMinutes: item.quotationResponseMinutes === null ? "" : String(item.quotationResponseMinutes),
    paymentDeadlineHours: item.paymentDeadlineHours === null ? "" : String(item.paymentDeadlineHours),
  };
}

function buildPayload(form: FormState) {
  const toNullableInt = (value: string) => (value.trim() === "" ? null : Number(value));
  return {
    documentVerificationHours: toNullableInt(form.documentVerificationHours),
    expectedCompletionHours: toNullableInt(form.expectedCompletionHours),
    quotationResponseMinutes: toNullableInt(form.quotationResponseMinutes),
    paymentDeadlineHours: toNullableInt(form.paymentDeadlineHours),
  };
}

function TimelineCard({ item, onSaved }: { item: TimelineData; onSaved: (item: TimelineData) => void }) {
  const [form, setForm] = useState<FormState>(toFormState(item));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

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
          hint="Not yet wired into an automation reminder."
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
          hint="Not yet wired into an automation reminder."
          value={form.expectedCompletionHours}
          onChange={(event) => setForm({ ...form, expectedCompletionHours: event.target.value })}
          error={errors.expectedCompletionHours?.[0]}
          disabled={saving}
        />
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
      </div>
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void handleSave()} isLoading={saving} disabled={!dirty}>
          Save Changes
        </Button>
      </div>
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
export function ServiceTimelinesManager() {
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

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <TimelineCard
          key={item.id}
          item={item}
          onSaved={(updated) => setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)))}
        />
      ))}
    </div>
  );
}
